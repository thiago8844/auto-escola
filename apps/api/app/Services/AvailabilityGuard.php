<?php

namespace App\Services;

use App\Exceptions\BusinessRuleException;
use App\Models\AvailabilityBlock;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\Vehicle;
use Carbon\CarbonInterface;

/**
 * Aplica bloqueios de agenda e horário de atendimento no agendamento e na remarcação de aulas e exames.
 *
 * Deve rodar depois do lock do instrutor/veículo (mesma transação das demais verificações): a criação de
 * um bloqueio trava a mesma linha, então reserva e bloqueio simultâneos se enfileiram no banco.
 *
 * Privacidade: uma indisponibilidade pessoal criada em OUTRO espaço aparece apenas como "instrutor indisponível",
 * sem motivo, tipo ou nome do espaço.
 */
class AvailabilityGuard
{
    public function __construct(private readonly WorkingHours $hours) {}

    public function assertVehicleNotBlocked(Vehicle $vehicle, CarbonInterface $startsAt, CarbonInterface $endsAt, string $timezone): void
    {
        $block = AvailabilityBlock::query()->active()
            ->where('resource_type', 'vehicle')
            ->where('vehicle_id', $vehicle->getKey())
            ->overlapping($startsAt, $endsAt)
            ->orderBy('starts_at')
            ->first();

        if ($block === null) {
            return;
        }

        throw new BusinessRuleException(
            "O veículo {$vehicle->plate} está bloqueado para {$this->label($block)} ({$this->period($block, $timezone)}). "
            .'Libere o bloqueio, escolha outro veículo ou outro horário.',
            'vehicle_blocked',
            409,
        );
    }

    public function assertInstructorNotBlocked(Organization $organization, Instructor $instructor, CarbonInterface $startsAt, CarbonInterface $endsAt): void
    {
        $block = AvailabilityBlock::query()->active()
            ->where('resource_type', 'instructor')
            ->where('instructor_id', $instructor->getKey())
            ->where(fn ($q) => $q->where('scope', 'personal')->orWhere('organization_id', $organization->getKey()))
            ->overlapping($startsAt, $endsAt)
            ->orderBy('starts_at')
            ->first();

        if ($block === null) {
            return;
        }

        $timezone = $organization->timezone ?: config('autoescola.default_timezone');

        if ($block->organization_id !== $organization->getKey()) {
            throw new BusinessRuleException('Instrutor indisponível nesse horário.', 'instructor_unavailable', 409);
        }

        throw new BusinessRuleException(
            "{$instructor->full_name} está indisponível por {$this->label($block)} ({$this->period($block, $timezone)}). "
            .'Escolha outro instrutor ou outro horário.',
            'instructor_blocked',
            409,
        );
    }

    /**
     * Horário de atendimento do espaço e do instrutor. Fora dele só com exceção justificada.
     * Retorna o motivo da exceção usada (para a auditoria) ou null.
     */
    public function assertWithinHours(
        Organization $organization,
        int $instructorId,
        CarbonInterface $startsAt,
        CarbonInterface $endsAt,
        ?string $overrideReason = null,
    ): ?string {
        $timezone = $organization->timezone ?: config('autoescola.default_timezone');
        $orgHours = $organization->business_hours;
        $pivot = $organization->instructors()->whereKey($instructorId)->first()?->pivot;
        $instructorHours = $pivot?->weekly_hours ? json_decode($pivot->weekly_hours, true) : null;

        foreach ([['do espaço', $orgHours], ['do instrutor', $instructorHours]] as [$whose, $hours]) {
            if ($hours === null || $this->hours->fits($hours, $startsAt, $endsAt, $timezone)) {
                continue;
            }

            if ($overrideReason !== null && trim($overrideReason) !== '') {
                return trim($overrideReason);
            }

            throw new BusinessRuleException(
                'Fora do horário de atendimento '.$whose.' ('.$this->hours->describeDay($hours, $startsAt, $timezone).'). '
                .'Escolha outro horário ou confirme a exceção informando o motivo.',
                'outside_business_hours',
                422,
            );
        }

        return null;
    }

    private function label(AvailabilityBlock $block): string
    {
        return mb_strtolower(AvailabilityBlock::KIND_LABELS[$block->kind] ?? 'indisponibilidade');
    }

    private function period(AvailabilityBlock $block, string $timezone): string
    {
        return 'de '.$block->starts_at->setTimezone($timezone)->format('d/m H:i')
            .' a '.$block->ends_at->setTimezone($timezone)->format('d/m H:i');
    }
}
