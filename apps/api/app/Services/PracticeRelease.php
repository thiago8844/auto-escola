<?php

namespace App\Services;

use App\Exceptions\BusinessRuleException;
use App\Models\Enrollment;

/**
 * Confere se a matrícula está liberada para ter aulas EXECUTADAS.
 *
 * Agendar é permitido antes da liberação (pré-reserva); concluir a aula não. Matrícula
 * sem processo não tem checklist a conferir e não é bloqueada.
 */
class PracticeRelease
{
    public function assertReleased(Enrollment $enrollment): void
    {
        $process = $enrollment->process()->with('checklistItems')->first();

        if ($process === null) {
            return;
        }

        $pending = $process->pendingRequiredItems();

        if ($pending->isEmpty()) {
            return;
        }

        $labels = $pending->map(fn ($item) => $item->type->label())->implode(', ');

        throw new BusinessRuleException(
            "Liberação para a prática pendente: {$labels}.",
            'practice_not_released',
            422,
        );
    }
}
