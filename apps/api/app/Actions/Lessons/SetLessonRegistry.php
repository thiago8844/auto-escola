<?php

namespace App\Actions\Lessons;

use App\Enums\LessonStatus;
use App\Enums\RegistryStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Lesson;

/**
 * Registra a situação do lançamento OFICIAL da aula (feito fora do sistema), com evidência.
 * Concluir a aula não implica registro oficial; este é um ato separado e manual.
 */
class SetLessonRegistry
{
    public function __invoke(Lesson $lesson, RegistryStatus $status, ?string $reference, ?int $documentId): Lesson
    {
        if ($status !== RegistryStatus::NotInformed && $lesson->status !== LessonStatus::Completed) {
            throw new BusinessRuleException(
                'O registro oficial só se aplica a aulas realizadas.',
                'lesson_not_completed',
                422,
            );
        }

        if ($status === RegistryStatus::Confirmed && $reference === null && $documentId === null) {
            throw new BusinessRuleException(
                'Para confirmar o registro oficial informe o protocolo/referência ou anexe a evidência.',
                'registry_evidence_required',
                422,
            );
        }

        $lesson->forceFill([
            'registry_status' => $status,
            'registry_reference' => $reference,
            'registry_document_id' => $documentId,
        ])->save();

        return $lesson;
    }
}
