<?php

namespace App\Services;

use App\Exceptions\BusinessRuleException;
use App\Models\Enrollment;
use Carbon\CarbonInterface;

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

    /**
     * Documento de liberação vencido na data da prática invalida a liberação, mesmo com o item já conferido.
     * Upload ou conferência passada não equivalem a liberação vigente.
     */
    public function assertDocumentsValid(Enrollment $enrollment, CarbonInterface $on): void
    {
        $process = $enrollment->process;

        if ($process === null) {
            return;
        }

        $expired = $process->checklistItems()
            ->where('required', true)
            ->whereNotNull('document_id')
            ->with('document')
            ->get()
            ->filter(fn ($item) => $item->status->clearsPractice()
                && $item->document?->expires_at !== null
                && $item->document->expires_at->toDateString() < $on->toDateString());

        if ($expired->isEmpty()) {
            return;
        }

        $labels = $expired->map(fn ($item) => $item->type->label())->implode(', ');

        throw new BusinessRuleException(
            "Documento de liberação vencido: {$labels}. Anexe uma versão válida e confira o item novamente.",
            'practice_document_expired',
            422,
        );
    }
}
