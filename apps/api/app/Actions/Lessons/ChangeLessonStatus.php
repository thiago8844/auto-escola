<?php

namespace App\Actions\Lessons;

use App\Enums\LessonStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Lesson;
use App\Models\Enrollment;
use App\Services\Audit;
use App\Services\CreditLedger;
use App\Services\PracticeRelease;
use Illuminate\Support\Facades\DB;

/**
 * Altera o status de uma aula seguindo as transições permitidas (ver LessonStatus).
 *
 * Concluir exige a matrícula liberada para a prática (checklist do processo) e grava a
 * duração real (padrão: a agendada) e a evolução. Falta e cancelamento guardam o motivo.
 * Estados finais não mudam, então concluir duas vezes é rejeitado e nada é contado em dobro.
 * A mesma transação encerra a reserva e grava o consumo no saldo (uma única vez por aula).
 */
class ChangeLessonStatus
{
    public function __construct(
        private readonly PracticeRelease $release,
        private readonly CreditLedger $ledger,
        private readonly Audit $audit,
    ) {}

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

            $enrollment = Enrollment::query()->whereKey($current->enrollment_id)->lockForUpdate()->firstOrFail();
            $current->setRelation('enrollment', $enrollment);
            $this->ledger->settle($current, $next);

            $this->audit->record($current->organization_id, 'lesson.'.$next->value, match ($next) {
                LessonStatus::Completed => 'Aula realizada.',
                LessonStatus::Missed => 'Falta registrada.',
                default => 'Aula cancelada.',
            }, [
                'enrollment_id' => $enrollment->getKey(),
                'student_id' => $enrollment->student_id,
                'process_id' => $enrollment->qualification_process_id,
                'reason' => $reason,
                'subject' => $current,
            ]);

            return $current;
        });
    }
}
