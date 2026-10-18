<?php

namespace App\Services;

use App\Enums\VehicleStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\AvailabilityBlock;
use App\Models\Lesson;

/**
 * Revalida, na hora de executar a aula, o que pode ter mudado depois do agendamento: liberação e documentos
 * do aluno, veículo inativo, veículo bloqueado e CRLV vencido. Aula agendada é uma pré-reserva; só vira
 * prática liberada se nenhum impedimento existir.
 */
class ExecutionChecks
{
    public function __construct(private readonly PracticeRelease $release) {}

    /**
     * @return list<array{code: string, message: string}>
     */
    public function blockers(Lesson $lesson): array
    {
        $blockers = [];
        $timezone = $lesson->organization?->timezone ?: config('autoescola.default_timezone');

        $collect = function (callable $check) use (&$blockers): void {
            try {
                $check();
            } catch (BusinessRuleException $e) {
                $blockers[] = ['code' => $e->errorCode, 'message' => $e->getMessage()];
            }
        };

        $collect(fn () => $this->release->assertReleased($lesson->enrollment));
        $collect(fn () => $this->release->assertDocumentsValid($lesson->enrollment, $lesson->starts_at->setTimezone($timezone)));

        $vehicle = $lesson->vehicle;

        if ($vehicle !== null) {
            if ($vehicle->status !== VehicleStatus::Active) {
                $blockers[] = ['code' => 'vehicle_inactive', 'message' => "O veículo {$vehicle->plate} está inativo. Troque o veículo da aula ou reative-o."];
            }

            if ($vehicle->crlv_expires_at !== null
                && $vehicle->crlv_expires_at->toDateString() < $lesson->starts_at->setTimezone($timezone)->toDateString()) {
                $blockers[] = ['code' => 'vehicle_document_expired', 'message' => "O CRLV do veículo {$vehicle->plate} estava vencido na data da aula. Atualize o documento ou troque o veículo."];
            }

            $block = AvailabilityBlock::query()->active()
                ->where('resource_type', 'vehicle')
                ->where('vehicle_id', $vehicle->getKey())
                ->overlapping($lesson->starts_at, $lesson->ends_at)
                ->first();

            if ($block !== null) {
                $label = mb_strtolower(AvailabilityBlock::KIND_LABELS[$block->kind] ?? 'indisponibilidade');
                $blockers[] = ['code' => 'vehicle_blocked', 'message' => "O veículo {$vehicle->plate} está bloqueado para {$label} neste horário. Libere o bloqueio ou troque o veículo."];
            }
        }

        return $blockers;
    }

    public function assertCanComplete(Lesson $lesson): void
    {
        $first = $this->blockers($lesson)[0] ?? null;

        if ($first !== null) {
            $status = $first['code'] === 'practice_not_released' || $first['code'] === 'practice_document_expired' ? 422 : 409;
            throw new BusinessRuleException($first['message'], $first['code'], $status);
        }
    }
}
