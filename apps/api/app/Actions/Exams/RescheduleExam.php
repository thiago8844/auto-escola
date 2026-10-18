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
 * Remarca uma tentativa agendada, preservando no histórico a data, o local e os responsáveis anteriores.
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
            $duration = (int) ($data['duration_minutes'] ?? $exam->duration_minutes);
            $instructorId = array_key_exists('instructor_id', $data) ? $data['instructor_id'] : $exam->instructor_id;
            $vehicleId = array_key_exists('vehicle_id', $data) ? $data['vehicle_id'] : $exam->vehicle_id;

            $this->planner->assertResourcesFree($organization, $exam->student_id, $instructorId, $vehicleId, $startsAt, $duration, $exam->getKey());

            $current = PracticalExam::query()->whereKey($exam->getKey())->lockForUpdate()->firstOrFail();

            if ($current->status !== ExamStatus::Scheduled) {
                throw new BusinessRuleException('Apenas exames agendados podem ser remarcados.', 'invalid_status_transition', 422);
            }

            $history = $current->schedule_history ?? [];
            $history[] = [
                'scheduled_at' => $current->scheduled_at->toIso8601String(),
                'duration_minutes' => $current->duration_minutes,
                'location' => $current->location,
                'instructor_id' => $current->instructor_id,
                'vehicle_id' => $current->vehicle_id,
                'changed_by' => auth()->id(),
                'changed_at' => now()->toIso8601String(),
                'reason' => $data['reason'] ?? null,
            ];

            $current->forceFill([
                'scheduled_at' => $startsAt->utc(),
                'duration_minutes' => $duration,
                'location' => array_key_exists('location', $data) ? $data['location'] : $current->location,
                'instructor_id' => $instructorId,
                'vehicle_id' => $vehicleId,
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
                    'location' => ['from' => $history[array_key_last($history)]['location'], 'to' => $current->location],
                ],
            ]);

            return $current;
        });
    }
}
