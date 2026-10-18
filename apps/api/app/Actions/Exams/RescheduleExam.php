<?php

namespace App\Actions\Exams;

use App\Enums\ExamStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\PracticalExam;
use App\Services\Audit;
use App\Services\ExamPlanner;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Remarca por imprevisto uma tentativa agendada: só a data muda; a anterior e o motivo ficam no histórico.
 * Para corrigir uma data digitada errada ou qualquer outro dado, use a edição (UpdateExam).
 */
class RescheduleExam
{
    public function __construct(private readonly ExamPlanner $planner, private readonly Audit $audit) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function __invoke(PracticalExam $exam, array $data): PracticalExam
    {
        return DB::transaction(function () use ($exam, $data) {
            $organization = $exam->organization;
            $startsAt = CarbonImmutable::parse($data['scheduled_at']);

            $this->planner->assertResourcesFree($organization, $exam->student_id, $exam->instructor_id, $exam->vehicle_id, $startsAt, $exam->getKey());

            $current = PracticalExam::query()->whereKey($exam->getKey())->lockForUpdate()->firstOrFail();

            if ($current->status !== ExamStatus::Scheduled) {
                throw new BusinessRuleException('Apenas exames agendados podem ser remarcados.', 'invalid_status_transition', 422);
            }

            $history = $current->schedule_history ?? [];
            $history[] = [
                'scheduled_at' => $current->scheduled_at->toIso8601String(),
                'changed_by' => auth()->id(),
                'changed_at' => now()->toIso8601String(),
                'reason' => $data['reason'] ?? null,
            ];

            $current->forceFill([
                'scheduled_at' => $startsAt->utc(),
                'reschedule_count' => $current->reschedule_count + 1,
                'schedule_history' => $history,
            ])->save();

            $this->audit->record($current->organization_id, 'exam.rescheduled', 'Exame remarcado.', [
                'student_id' => $current->student_id,
                'process_id' => $current->qualification_process_id,
                'enrollment_id' => $current->enrollment_id,
                'subject' => $current,
                'reason' => $data['reason'] ?? null,
                'changes' => [
                    'scheduled_at' => ['from' => $history[array_key_last($history)]['scheduled_at'], 'to' => $current->scheduled_at->toIso8601String()],
                ],
            ]);

            return $current;
        });
    }
}
