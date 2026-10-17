<?php

namespace App\Actions\Lessons;

use App\Enums\LessonStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Lesson;
use App\Services\InstructorAvailability;
use App\Services\SchedulingConstraints;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Remarca uma aula agendada. Instrutor e veículo não mudam nesta operação, mas a
 * disponibilidade de instrutor, veículo e aluno é conferida no novo horário.
 */
class RescheduleLesson
{
    public function __construct(
        private readonly InstructorAvailability $availability,
        private readonly SchedulingConstraints $constraints,
    ) {}

    public function __invoke(Lesson $lesson, CarbonImmutable $startsAt, CarbonImmutable $endsAt): Lesson
    {
        return DB::transaction(function () use ($lesson, $startsAt, $endsAt) {
            $current = Lesson::query()->whereKey($lesson->getKey())->lockForUpdate()->firstOrFail();
            $instructor = $this->availability->lockInstructor($current->instructor_id);

            if ($current->status !== LessonStatus::Scheduled) {
                throw new BusinessRuleException(
                    'Apenas aulas agendadas podem ser remarcadas.',
                    'invalid_status_transition',
                    422,
                );
            }

            $this->availability->assertAvailable(
                $current->instructor_id,
                $startsAt,
                $endsAt,
                ignoreLessonId: $current->getKey(),
            );

            if ($current->vehicle_id !== null) {
                $vehicle = $this->constraints->lockVehicle($current->vehicle_id);
                $this->constraints->assertVehicleUsable(
                    $vehicle,
                    $current->enrollment,
                    $instructor,
                    $startsAt,
                    $current->organization->timezone,
                );
                $this->constraints->assertVehicleAvailable($current->vehicle_id, $startsAt, $endsAt, $current->getKey());
            }

            $studentId = $current->enrollment->student_id;
            $this->constraints->lockStudent($studentId);
            $this->constraints->assertStudentAvailable($studentId, $startsAt, $endsAt, $current->getKey());

            $current->forceFill([
                'starts_at' => $startsAt->utc(),
                'ends_at' => $endsAt->utc(),
            ])->save();

            return $current;
        });
    }
}
