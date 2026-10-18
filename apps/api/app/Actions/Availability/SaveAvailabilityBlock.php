<?php

namespace App\Actions\Availability;

use App\Exceptions\BusinessRuleException;
use App\Models\AvailabilityBlock;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\Vehicle;
use App\Services\Audit;
use App\Services\CommitmentFinder;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Cria, altera e libera bloqueios de agenda. Nunca cancela compromissos: devolve a lista dos que ficaram
 * afetados para que a equipe resolva cada um (remarcar, trocar veículo/instrutor ou cancelar).
 *
 * O recurso (veículo/instrutor) é travado antes de gravar, na mesma ordem do agendamento, então um
 * agendamento e um bloqueio simultâneos se enfileiram no banco.
 */
class SaveAvailabilityBlock
{
    public function __construct(private readonly Audit $audit, private readonly CommitmentFinder $finder) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array{block: AvailabilityBlock, affected: list<array<string, mixed>>, external_affected: int}
     */
    public function create(Organization $organization, array $data, ?int $maintenanceId = null): array
    {
        return DB::transaction(function () use ($organization, $data, $maintenanceId) {
            $this->lockResource($organization, $data['resource_type'], $data['vehicle_id'] ?? null, $data['instructor_id'] ?? null);

            $block = AvailabilityBlock::create([
                'organization_id' => $organization->getKey(),
                'resource_type' => $data['resource_type'],
                'vehicle_id' => $data['resource_type'] === 'vehicle' ? $data['vehicle_id'] : null,
                'instructor_id' => $data['resource_type'] === 'instructor' ? $data['instructor_id'] : null,
                'scope' => $data['resource_type'] === 'instructor' ? ($data['scope'] ?? 'organization') : 'organization',
                'kind' => $data['kind'],
                'starts_at' => CarbonImmutable::parse($data['starts_at'])->utc(),
                'ends_at' => CarbonImmutable::parse($data['ends_at'])->utc(),
                'reason' => $data['reason'] ?? null,
                'maintenance_id' => $maintenanceId,
                'created_by' => auth()->id(),
            ]);

            $this->audit->record($organization->getKey(), 'availability.blocked', $this->summary($block, 'criado'), [
                'subject' => $block,
                'reason' => $block->reason,
                'changes' => ['starts_at' => $block->starts_at->toIso8601String(), 'ends_at' => $block->ends_at->toIso8601String(), 'kind' => $block->kind],
            ]);

            return $this->result($organization, $block);
        });
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{block: AvailabilityBlock, affected: list<array<string, mixed>>, external_affected: int}
     */
    public function update(AvailabilityBlock $block, array $data): array
    {
        return DB::transaction(function () use ($block, $data) {
            $organization = $block->organization;
            $this->lockResource($organization, $block->resource_type, $block->vehicle_id, $block->instructor_id);

            $current = AvailabilityBlock::query()->whereKey($block->getKey())->lockForUpdate()->firstOrFail();

            if (! $current->isActive()) {
                throw new BusinessRuleException('Este bloqueio já foi liberado e não pode mais ser alterado.', 'block_released', 422);
            }

            $before = ['starts_at' => $current->starts_at->toIso8601String(), 'ends_at' => $current->ends_at->toIso8601String(), 'reason' => $current->reason];

            $current->fill(array_filter([
                'kind' => $data['kind'] ?? null,
                'starts_at' => isset($data['starts_at']) ? CarbonImmutable::parse($data['starts_at'])->utc() : null,
                'ends_at' => isset($data['ends_at']) ? CarbonImmutable::parse($data['ends_at'])->utc() : null,
            ], fn ($v) => $v !== null));

            if (array_key_exists('reason', $data)) {
                $current->reason = $data['reason'];
            }

            if ($current->ends_at <= $current->starts_at) {
                throw new BusinessRuleException('O fim do bloqueio deve ser depois do início.', 'block_period_invalid', 422);
            }

            $current->save();

            $this->audit->record($current->organization_id, 'availability.updated', $this->summary($current, 'alterado'), [
                'subject' => $current,
                'changes' => ['from' => $before, 'to' => ['starts_at' => $current->starts_at->toIso8601String(), 'ends_at' => $current->ends_at->toIso8601String(), 'reason' => $current->reason]],
            ]);

            return $this->result($organization, $current);
        });
    }

    public function release(AvailabilityBlock $block, ?string $note = null): AvailabilityBlock
    {
        return DB::transaction(function () use ($block, $note) {
            $this->lockResource($block->organization, $block->resource_type, $block->vehicle_id, $block->instructor_id);

            $current = AvailabilityBlock::query()->whereKey($block->getKey())->lockForUpdate()->firstOrFail();

            if ($current->isActive()) {
                $current->forceFill([
                    'status' => 'released',
                    'released_at' => now(),
                    'released_by' => auth()->id(),
                    'release_note' => $note,
                ])->save();

                $this->audit->record($current->organization_id, 'availability.released', $this->summary($current, 'liberado'), [
                    'subject' => $current,
                    'reason' => $note,
                ]);
            }

            return $current;
        });
    }

    /**
     * @return array{block: AvailabilityBlock, affected: list<array<string, mixed>>, external_affected: int}
     */
    private function result(Organization $organization, AvailabilityBlock $block): array
    {
        $isInstructor = $block->resource_type === 'instructor';

        return [
            'block' => $block,
            'affected' => $this->finder->find(
                $organization,
                $block->vehicle_id,
                $block->instructor_id,
                $block->starts_at,
                $block->ends_at,
            ),
            // Indisponibilidade pessoal também atinge compromissos de outros espaços: só a quantidade é revelada.
            'external_affected' => $isInstructor && $block->isPersonal()
                ? $this->finder->externalCount($organization, $block->instructor_id, $block->starts_at, $block->ends_at)
                : 0,
        ];
    }

    private function lockResource(Organization $organization, string $type, ?int $vehicleId, ?int $instructorId): void
    {
        if ($type === 'instructor') {
            Instructor::query()->whereKey($instructorId)->lockForUpdate()->firstOrFail();
        } else {
            Vehicle::query()->whereKey($vehicleId)->lockForUpdate()->firstOrFail();
        }
    }

    private function summary(AvailabilityBlock $block, string $action): string
    {
        $kind = mb_strtolower(AvailabilityBlock::KIND_LABELS[$block->kind] ?? 'bloqueio');

        return "Bloqueio de {$kind} ({$block->resource_type}) {$action}.";
    }
}
