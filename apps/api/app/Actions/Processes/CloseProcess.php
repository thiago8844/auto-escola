<?php

namespace App\Actions\Processes;

use App\Actions\Exams\RecordExamResult;
use App\Actions\Lessons\ChangeLessonStatus;
use App\Enums\ClosureKind;
use App\Enums\ExamStatus;
use App\Enums\LessonStatus;
use App\Enums\ProcessStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Lesson;
use App\Models\QualificationProcess;
use App\Services\Audit;
use App\Services\ProcessOutcome;
use Illuminate\Support\Facades\DB;

/**
 * Conclui, encerra ou registra desistência do acompanhamento, e reabre.
 *
 * - Concluir exige todas as categorias aprovadas/renunciadas e a emissão registrada.
 * - Aulas e exames futuros nunca ficam órfãos: ou são cancelados explicitamente (com a liberação
 *   da reserva de saldo) ou o encerramento é recusado.
 * - Créditos e obrigações abertas NÃO são removidos: a equipe reconhece a pendência com motivo.
 */
class CloseProcess
{
    public function __construct(
        private readonly Audit $audit,
        private readonly ProcessOutcome $outcome,
        private readonly ChangeLessonStatus $changeLesson,
        private readonly RecordExamResult $recordExam,
    ) {}

    /**
     * @param  array{kind: string, reason?: ?string, cancel_future?: bool, acknowledge_pending?: bool}  $data
     */
    public function close(QualificationProcess $process, array $data): QualificationProcess
    {
        return DB::transaction(function () use ($process, $data) {
            $current = QualificationProcess::query()->whereKey($process->getKey())->lockForUpdate()->firstOrFail();
            $kind = ClosureKind::from($data['kind']);
            $reason = $data['reason'] ?? null;

            if (in_array($current->status, [ProcessStatus::Completed, ProcessStatus::Closed], true)) {
                throw new BusinessRuleException('O processo já está encerrado.', 'process_closed', 422);
            }

            $check = $this->outcome->closureCheck($current);

            if ($kind === ClosureKind::Completed && ! $check['can_complete']) {
                throw new BusinessRuleException(
                    'Para concluir, todas as categorias precisam estar aprovadas ou renunciadas e a emissão do documento registrada. Use encerramento/desistência com motivo se for o caso.',
                    'process_not_ready',
                    422,
                );
            }

            if ($kind !== ClosureKind::Completed && ($reason === null || trim($reason) === '')) {
                throw new BusinessRuleException('Informe o motivo do encerramento.', 'reason_required', 422);
            }

            if (($check['future_lessons'] > 0 || $check['future_exams'] > 0) && empty($data['cancel_future'])) {
                throw new BusinessRuleException(
                    "Há {$check['future_lessons']} aula(s) e {$check['future_exams']} exame(s) agendados. Cancele-os ou confirme o cancelamento no encerramento.",
                    'future_commitments',
                    422,
                );
            }

            if ($check['pending'] !== [] && empty($data['acknowledge_pending'])) {
                throw new BusinessRuleException(
                    'Há pendências em aberto: '.implode(' ', array_column($check['pending'], 'message')).' Confirme que deseja encerrar mesmo assim.',
                    'pending_items',
                    422,
                );
            }

            $note = 'Encerramento do processo.';
            Lesson::query()->whereIn('enrollment_id', $current->enrollments()->pluck('id'))
                ->where('status', LessonStatus::Scheduled->value)->get()
                ->each(fn (Lesson $lesson) => ($this->changeLesson)($lesson, LessonStatus::Cancelled, reason: $note));
            $current->exams()->where('status', ExamStatus::Scheduled->value)->get()
                ->each(fn ($exam) => ($this->recordExam)($exam, ExamStatus::Cancelled, $note));

            $current->forceFill([
                'status' => $kind === ClosureKind::Completed ? ProcessStatus::Completed : ProcessStatus::Closed,
                'closure_kind' => $kind->value,
                'closure_reason' => $reason,
                'closed_at' => now(),
            ])->save();

            $this->audit->record($current->organization_id, 'process.closed', match ($kind) {
                ClosureKind::Completed => 'Processo concluído.',
                ClosureKind::Abandoned => 'Processo encerrado por desistência.',
                ClosureKind::Other => 'Processo encerrado.',
            }, [
                'student_id' => $current->student_id,
                'process_id' => $current->getKey(),
                'subject' => $current,
                'reason' => $reason,
                'changes' => [
                    'cancelled_lessons' => $check['future_lessons'],
                    'cancelled_exams' => $check['future_exams'],
                    'acknowledged_pending' => array_column($check['pending'], 'code'),
                ],
            ]);

            return $current;
        });
    }

    public function reopen(QualificationProcess $process, string $reason): QualificationProcess
    {
        return DB::transaction(function () use ($process, $reason) {
            $current = QualificationProcess::query()->whereKey($process->getKey())->lockForUpdate()->firstOrFail();

            if (! in_array($current->status, [ProcessStatus::Completed, ProcessStatus::Closed], true)) {
                throw new BusinessRuleException('Apenas processos encerrados podem ser reabertos.', 'process_not_closed', 422);
            }

            $previous = $current->status;
            $current->forceFill(['status' => ProcessStatus::Active, 'closure_kind' => null, 'closure_reason' => null, 'closed_at' => null])->save();

            $this->audit->record($current->organization_id, 'process.reopened', 'Processo reaberto.', [
                'student_id' => $current->student_id,
                'process_id' => $current->getKey(),
                'subject' => $current,
                'reason' => $reason,
                'changes' => ['status' => ['from' => $previous->value, 'to' => 'active']],
            ]);

            return $current;
        });
    }
}
