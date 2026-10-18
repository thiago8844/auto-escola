<?php

namespace App\Actions\Exams;

use App\Enums\ExamStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\PracticalExam;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;

/**
 * Corrige um resultado registrado por engano. O resultado anterior fica preservado na trilha
 * de auditoria (antes/depois, autor, data e motivo) e só afeta a própria tentativa.
 */
class CorrectExamResult
{
    public function __construct(private readonly Audit $audit) {}

    public function __invoke(PracticalExam $exam, ExamStatus $next, string $reason): PracticalExam
    {
        return DB::transaction(function () use ($exam, $next, $reason) {
            $current = PracticalExam::query()->whereKey($exam->getKey())->lockForUpdate()->firstOrFail();

            if (! $current->status->isResult() || ! $next->isResult()) {
                throw new BusinessRuleException('Só é possível corrigir entre resultados já registrados.', 'invalid_status_transition', 422);
            }

            if ($current->status === $next) {
                throw new BusinessRuleException('O resultado informado é igual ao atual.', 'result_unchanged', 422);
            }

            if ($next === ExamStatus::Approved && PracticalExam::query()
                ->where('qualification_process_id', $current->qualification_process_id)
                ->where('category', $current->category)
                ->where('status', ExamStatus::Approved->value)
                ->whereKeyNot($current->getKey())
                ->exists()) {
                throw new BusinessRuleException('Já existe outra tentativa aprovada nesta categoria.', 'category_already_approved', 422);
            }

            $previous = $current->status;

            $current->forceFill(['status' => $next, 'status_reason' => $reason, 'result_at' => now()])->save();

            $this->audit->record($current->organization_id, 'exam.result_corrected',
                "Resultado do exame {$current->category} (tentativa {$current->attempt_number}) corrigido: {$previous->value} → {$next->value}.", [
                    'student_id' => $current->student_id,
                    'process_id' => $current->qualification_process_id,
                    'enrollment_id' => $current->enrollment_id,
                    'subject' => $current,
                    'reason' => $reason,
                    'changes' => ['status' => ['from' => $previous->value, 'to' => $next->value]],
                ]);

            return $current;
        });
    }
}
