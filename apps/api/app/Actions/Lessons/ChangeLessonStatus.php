<?php

namespace App\Actions\Lessons;

use App\Enums\LessonStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Lesson;
use App\Services\PracticeRelease;
use Illuminate\Support\Facades\DB;

/**
 * Altera o status de uma aula seguindo as transições permitidas (ver LessonStatus).
 *
 * Concluir exige a matrícula liberada para a prática (checklist do processo) e grava a
 * duração real (padrão: a agendada) e a evolução. Falta e cancelamento guardam o motivo.
 * Estados finais não mudam, então concluir duas vezes é rejeitado e nada é contado em dobro.
 */
class ChangeLessonStatus
{
    public function __construct(private readonly PracticeRelease $release) {}

    public function __invoke(
        Lesson $lesson,
        LessonStatus $next,
        ?string $notes = null,
        ?string $reason = null,
        ?int $actualMinutes = null,
        ?string $evolution = null,
    ): Lesson {
        return DB::transaction(function () use ($lesson, $next, $notes, $reason, $actualMinutes, $evolution) {
            $current = Lesson::query()->whereKey($lesson->getKey())->lockForUpdate()->firstOrFail();

            if (! $current->status->canTransitionTo($next)) {
                throw new BusinessRuleException(
                    "Não é possível alterar o status de {$current->status->value} para {$next->value}.",
                    'invalid_status_transition',
                    422,
                );
            }

            $changes = ['status' => $next, 'notes' => $notes];

            if ($next === LessonStatus::Completed) {
                $this->release->assertReleased($current->enrollment);

                $changes['actual_minutes'] = $actualMinutes ?? $current->scheduledMinutes();
                $changes['evolution'] = $evolution;
            } else {
                $changes['status_reason'] = $reason;
            }

            $current->forceFill(array_filter($changes, fn ($value) => $value !== null))->save();

            return $current;
        });
    }
}
