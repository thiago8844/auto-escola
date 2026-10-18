<?php

namespace App\Services;

use App\Exceptions\BusinessRuleException;
use App\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/** Consulta até 96 inícios em intervalos de 15 min no dia escolhido, sem gravar reservas. */
class AvailableLessonSlots
{
    public function __construct(
        private readonly InstructorAvailability $availability,
        private readonly SchedulingConstraints $constraints,
        private readonly AvailabilityGuard $guard,
        private readonly CreditLedger $ledger,
    ) {}

    /** @param array<string, mixed> $input
     * @return list<array{starts_at: string, ends_at: string}>
     */
    public function find(Organization $organization, array $input): array
    {
        return DB::transaction(function () use ($organization, $input): array {
            $instructor = $this->availability->lockInstructor((int) $input['instructor_id']);
            if (! $organization->instructors()->whereKey($instructor->getKey())->wherePivot('active', true)->exists()) {
                throw new BusinessRuleException('Este instrutor não está ativo neste espaço.', 'instructor_inactive');
            }
            $vehicle = isset($input['vehicle_id']) ? $this->constraints->lockVehicle((int) $input['vehicle_id']) : null;
            $enrollment = $organization->enrollments()->findOrFail($input['enrollment_id']);
            $this->constraints->lockStudent($enrollment->student_id);
            $enrollment = $organization->enrollments()->whereKey($enrollment->getKey())->lockForUpdate()->firstOrFail();
            if (! $enrollment->status->acceptsLessons()) {
                throw new BusinessRuleException('Esta matrícula está encerrada e não aceita novas aulas.', 'enrollment_closed');
            }
            $category = $this->ledger->lessonCategory($enrollment, $vehicle, $input['category'] ?? null);
            $this->ledger->assertCanReserve($enrollment, $category, (int) $input['duration'], null);
            $day = CarbonImmutable::parse($input['date'], $organization->timezone)->startOfDay();
            $slots = [];
            [$hour, $minuteOfHour] = array_map('intval', explode(':', $input['from_time'] ?? '08:00'));
            for ($minute = $hour * 60 + $minuteOfHour; $minute < 1440 && count($slots) < 5; $minute += 15) {
                $start = $day->addMinutes($minute)->utc();
                $end = $start->addMinutes((int) $input['duration']);
                if ($start->isPast() || $end->greaterThan($day->addDay())) {
                    continue;
                }
                try {
                    $this->availability->assertAvailable($instructor->getKey(), $start, $end);
                    $this->guard->assertInstructorNotBlocked($organization, $instructor, $start, $end);
                    $this->guard->assertWithinHours($organization, $instructor->getKey(), $start, $end);
                    if ($vehicle !== null) {
                        $this->constraints->assertVehicleUsable($vehicle, $enrollment, $instructor, $start, $organization->timezone);
                        $this->constraints->assertVehicleAvailable($vehicle->getKey(), $start, $end);
                        $this->guard->assertVehicleNotBlocked($vehicle, $start, $end, $organization->timezone);
                    }
                    $this->constraints->assertStudentAvailable($enrollment->student_id, $start, $end);
                    $slots[] = ['starts_at' => $start->utc()->toIso8601String(), 'ends_at' => $end->utc()->toIso8601String()];
                } catch (BusinessRuleException $exception) {
                    if (! in_array($exception->errorCode, ['instructor_unavailable', 'instructor_blocked', 'outside_business_hours', 'vehicle_unavailable', 'vehicle_blocked', 'student_unavailable'], true)) {
                        throw $exception;
                    }
                }
            }

            return $slots;
        });
    }
}
