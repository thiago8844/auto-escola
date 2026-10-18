<?php

namespace App\Actions\Exams;

use App\Enums\ExamStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\PracticalExam;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;

/**
 * Registra o resultado (ou cancelamento) de uma tentativa agendada, uma única vez.
 * Corrigir um resultado já registrado é outra operação (CorrectExamResult), com motivo.
 * Ausência não é reprovação e não é tratada como tal em nenhum cálculo.
 */
class RecordExamResult
{
    public function __construct(private readonly Audit $audit) {}

    public function __invoke(PracticalExam $exam, ExamStatus $next, ?string $reason = null): PracticalExam
    {
        return DB::transaction(function () use ($exam, $next, $reason) {
            $current = PracticalExam::query()->whereKey($exam->getKey())->lockForUpdate()->firstOrFail();

            if (! in_array($next, $current->status->allowedTransitions(), true)) {
                throw new BusinessRuleException(
                    'Este exame já tem resultado ou foi cancelado. Para alterar, use a correção de resultado com motivo.',
                    'invalid_status_transition',
                    422,
                );
            }

            if (in_array($next, [ExamStatus::Cancelled, ExamStatus::Absent, ExamStatus::Incomplete], true) && ($reason === null || trim($reason) === '')) {
                throw new BusinessRuleException('Informe o motivo.', 'reason_required', 422);
            }

            $current->forceFill([
                'status' => $next,
                'status_reason' => $reason,
                'result_at' => $next->isResult() ? now() : null,
            ])->save();

            $this->audit->record($current->organization_id, 'exam.'.$next->value, match ($next) {
                ExamStatus::Approved => "Exame {$current->category} (tentativa {$current->attempt_number}): aprovado.",
                ExamStatus::Failed => "Exame {$current->category} (tentativa {$current->attempt_number}): reprovado.",
                ExamStatus::Absent => "Exame {$current->category} (tentativa {$current->attempt_number}): ausência do aluno.",
                ExamStatus::Incomplete => "Exame {$current->category} (tentativa {$current->attempt_number}): não concluído.",
                default => "Exame {$current->category} (tentativa {$current->attempt_number}): cancelado.",
            }, [
                'student_id' => $current->student_id,
                'process_id' => $current->qualification_process_id,
                'enrollment_id' => $current->enrollment_id,
                'subject' => $current,
                'reason' => $reason,
            ]);

            return $current;
        });
    }
}
