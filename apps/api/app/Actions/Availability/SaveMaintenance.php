<?php

namespace App\Actions\Availability;

use App\Exceptions\BusinessRuleException;
use App\Models\AvailabilityBlock;
use App\Models\Organization;
use App\Models\Vehicle;
use App\Models\VehicleMaintenance;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Manutenção de veículo. Pode nascer já com um bloqueio de agenda (mesma transação) e, ao ser concluída ou
 * cancelada, libera esse bloqueio. `finance_ref` é gerado uma única vez para o futuro lançamento no financeiro.
 */
class SaveMaintenance
{
    public function __construct(
        private readonly SaveAvailabilityBlock $blocks,
        private readonly Audit $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     * @return array{maintenance: VehicleMaintenance, affected: list<array<string, mixed>>}
     */
    public function create(Organization $organization, Vehicle $vehicle, array $data): array
    {
        return DB::transaction(function () use ($organization, $vehicle, $data) {
            $maintenance = VehicleMaintenance::create([
                'organization_id' => $organization->getKey(),
                'vehicle_id' => $vehicle->getKey(),
                'finance_ref' => (string) Str::uuid(),
                'created_by' => auth()->id(),
            ] + $this->fields($data));

            $affected = [];

            if (! empty($data['block'])) {
                $result = $this->blocks->create($organization, [
                    'resource_type' => 'vehicle',
                    'vehicle_id' => $vehicle->getKey(),
                    'kind' => 'maintenance',
                    'starts_at' => $data['block']['starts_at'],
                    'ends_at' => $data['block']['ends_at'],
                    'reason' => 'Manutenção: '.$maintenance->type,
                ], $maintenance->getKey());
                $affected = $result['affected'];
            }

            $this->audit->record($organization->getKey(), 'maintenance.created', "Manutenção registrada ({$maintenance->type}) para {$vehicle->plate}.", [
                'subject' => $maintenance,
                'changes' => ['finance_ref' => $maintenance->finance_ref, 'scheduled_on' => $maintenance->scheduled_on->toDateString()],
            ]);

            return ['maintenance' => $maintenance->load('block'), 'affected' => $affected];
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(VehicleMaintenance $maintenance, array $data): VehicleMaintenance
    {
        return DB::transaction(function () use ($maintenance, $data) {
            $current = $this->lock($maintenance);

            if ($current->status !== 'scheduled') {
                throw new BusinessRuleException('Só é possível alterar manutenções em aberto.', 'maintenance_closed', 422);
            }

            $current->fill($this->fields($data))->save();

            return $current->load('block');
        });
    }

    /**
     * Conclui o serviço: grava o realizado e libera o bloqueio de agenda ligado a ele.
     *
     * @param  array<string, mixed>  $data
     */
    public function complete(VehicleMaintenance $maintenance, array $data): VehicleMaintenance
    {
        return DB::transaction(function () use ($maintenance, $data) {
            $current = $this->lock($maintenance);

            if ($current->status !== 'scheduled') {
                throw new BusinessRuleException('Esta manutenção já foi encerrada.', 'maintenance_closed', 422);
            }

            $current->fill($this->fields($data) + ['performed_on' => $data['performed_on'] ?? now()->toDateString()])
                ->forceFill(['status' => 'done', 'completed_by' => auth()->id()])
                ->save();

            $this->releaseBlock($current, 'Serviço concluído.');

            $this->audit->record($current->organization_id, 'maintenance.completed', "Manutenção concluída ({$current->type}).", [
                'subject' => $current,
                'changes' => ['actual_cost_cents' => $current->actual_cost_cents, 'odometer_km' => $current->odometer_km],
            ]);

            return $current->load('block');
        });
    }

    public function cancel(VehicleMaintenance $maintenance, ?string $reason): VehicleMaintenance
    {
        return DB::transaction(function () use ($maintenance, $reason) {
            $current = $this->lock($maintenance);

            if ($current->status !== 'scheduled') {
                throw new BusinessRuleException('Esta manutenção já foi encerrada.', 'maintenance_closed', 422);
            }

            $current->forceFill(['status' => 'cancelled'])->save();
            $this->releaseBlock($current, $reason ?: 'Manutenção cancelada.');

            $this->audit->record($current->organization_id, 'maintenance.cancelled', "Manutenção cancelada ({$current->type}).", [
                'subject' => $current,
                'reason' => $reason,
            ]);

            return $current->load('block');
        });
    }

    private function lock(VehicleMaintenance $maintenance): VehicleMaintenance
    {
        return VehicleMaintenance::query()->whereKey($maintenance->getKey())->lockForUpdate()->firstOrFail();
    }

    private function releaseBlock(VehicleMaintenance $maintenance, string $note): void
    {
        $block = AvailabilityBlock::query()->where('maintenance_id', $maintenance->getKey())->where('status', 'active')->first();

        if ($block !== null) {
            $this->blocks->release($block, $note);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function fields(array $data): array
    {
        return array_intersect_key($data, array_flip([
            'type', 'scheduled_on', 'performed_on', 'provider', 'odometer_km', 'estimated_cost_cents',
            'actual_cost_cents', 'document_id', 'next_due_date', 'next_due_km', 'notes',
        ]));
    }
}
