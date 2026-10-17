<?php

namespace App\Actions\Lessons;

use App\Enums\LessonStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\Organization;
use App\Services\InstructorAvailability;
use App\Services\SchedulingConstraints;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Agenda uma aula dentro da organização, atribuindo um instrutor com vínculo ativo e,
 * opcionalmente, um veículo. Confere conflito de instrutor, veículo e aluno.
 *
 * Agendar não exige a liberação para a prática (pré-reserva); concluir a aula exige.
 */
class ScheduleLesson
{
    public function __construct(
        private readonly InstructorAvailability $availability,
        private readonly SchedulingConstraints $constraints,
    ) {}

    public function __invoke(
        Organization $organization,
        Enrollment $enrollment,
        int $instructorId,
        CarbonImmutable $startsAt,
        CarbonImmutable $endsAt,
        ?string $notes = null,
        ?int $vehicleId = null,
    ): Lesson {
        return DB::transaction(function () use ($organization, $enrollment, $instructorId, $startsAt, $endsAt, $notes, $vehicleId) {
            if (! $enrollment->status->acceptsLessons()) {
                throw new BusinessRuleException(
                    'Esta matrícula está encerrada e não aceita novas aulas.',
                    'enrollment_closed',
                    422,
                );
            }

            // Ordem de locks: instrutor → veículo → aluno (evita deadlock entre agendamentos).
            $instructor = $this->availability->lockInstructor($instructorId);

            $linkActive = $organization->instructors()
                ->whereKey($instructorId)
                ->wherePivot('active', true)
                ->exists();

            if (! $linkActive) {
                throw new BusinessRuleException(
                    'Este instrutor não está ativo nesta organização.',
                    'instructor_inactive',
                    422,
                );
            }

            $this->availability->assertAvailable($instructorId, $startsAt, $endsAt);

            if ($vehicleId !== null) {
                $vehicle = $this->constraints->lockVehicle($vehicleId);
                $this->constraints->assertVehicleUsable($vehicle, $enrollment, $instructor, $startsAt, $organization->timezone);
                $this->constraints->assertVehicleAvailable($vehicleId, $startsAt, $endsAt);
            }

            $this->constraints->lockStudent($enrollment->student_id);
            $this->constraints->assertStudentAvailable($enrollment->student_id, $startsAt, $endsAt);

            return Lesson::create([
                'organization_id' => $organization->getKey(),
                'enrollment_id' => $enrollment->getKey(),
                'instructor_id' => $instructorId,
                'vehicle_id' => $vehicleId,
                'starts_at' => $startsAt->utc(),
                'ends_at' => $endsAt->utc(),
                'status' => LessonStatus::Scheduled,
                'notes' => $notes,
            ]);
        });
    }
}
