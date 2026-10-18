<?php

namespace App\Actions\Lessons;

use App\Enums\LessonStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Lesson;
use App\Services\Audit;
use App\Services\AvailabilityGuard;
use App\Services\InstructorAvailability;
use App\Services\SchedulingConstraints;
use Illuminate\Support\Facades\DB;

/**
 * Troca o veículo e/ou o instrutor de uma aula agendada, conferindo os mesmos impedimentos do agendamento.
 * É a providência explícita para compromissos afetados por bloqueio ou inativação. O saldo não muda:
 * horário e duração permanecem.
 */
class ReassignLesson
{
    public function __construct(
        private readonly InstructorAvailability $availability,
        private readonly SchedulingConstraints $constraints,
        private readonly AvailabilityGuard $guard,
        private readonly Audit $audit,
    ) {}

    /**
     * @param  array<string, mixed>  $data  Chaves presentes são alteradas: vehicle_id (pode ser null), instructor_id.
     */
    public function __invoke(Lesson $lesson, array $data): Lesson
    {
        return DB::transaction(function () use ($lesson, $data) {
            $instructorId = $data['instructor_id'] ?? $lesson->instructor_id;
            $vehicleId = array_key_exists('vehicle_id', $data) ? $data['vehicle_id'] : $lesson->vehicle_id;

            $instructor = $this->availability->lockInstructor($instructorId);
            $current = Lesson::query()->whereKey($lesson->getKey())->lockForUpdate()->firstOrFail();
            $organization = $current->organization;

            if ($current->status !== LessonStatus::Scheduled) {
                throw new BusinessRuleException('Apenas aulas agendadas podem trocar instrutor ou veículo.', 'invalid_status_transition', 422);
            }

            if ($instructorId !== $current->instructor_id) {
                if (! $organization->instructors()->whereKey($instructorId)->wherePivot('active', true)->exists()) {
                    throw new BusinessRuleException('Este instrutor não está ativo nesta organização.', 'instructor_inactive', 422);
                }

                $this->availability->assertAvailable($instructorId, $current->starts_at, $current->ends_at, ignoreLessonId: $current->getKey());
                $this->guard->assertInstructorNotBlocked($organization, $instructor, $current->starts_at, $current->ends_at);
            }

            if ($vehicleId !== null) {
                $vehicle = $this->constraints->lockVehicle($vehicleId);
                $this->constraints->assertVehicleUsable($vehicle, $current->enrollment, $instructor, $current->starts_at, $organization->timezone);

                if ($vehicleId !== $current->vehicle_id) {
                    $this->constraints->assertVehicleAvailable($vehicleId, $current->starts_at, $current->ends_at, $current->getKey());
                    $this->guard->assertVehicleNotBlocked($vehicle, $current->starts_at, $current->ends_at, $organization->timezone);
                }

                if ($current->category !== null && $vehicle->category->value !== $current->category) {
                    throw new BusinessRuleException('A categoria do veículo difere da categoria da aula.', 'vehicle_category_mismatch', 422);
                }
            }

            $before = ['instructor_id' => $current->instructor_id, 'vehicle_id' => $current->vehicle_id];
            $current->forceFill(['instructor_id' => $instructorId, 'vehicle_id' => $vehicleId])->save();

            $this->audit->record($current->organization_id, 'lesson.reassigned', 'Instrutor ou veículo da aula alterado.', [
                'enrollment_id' => $current->enrollment_id,
                'student_id' => $current->enrollment->student_id,
                'process_id' => $current->enrollment->qualification_process_id,
                'subject' => $current,
                'changes' => ['from' => $before, 'to' => ['instructor_id' => $instructorId, 'vehicle_id' => $vehicleId]],
            ]);

            return $current;
        });
    }
}
