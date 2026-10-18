<?php

namespace App\Actions\Lessons;

use App\Enums\LessonStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\Organization;
use App\Services\Audit;
use App\Services\CreditLedger;
use App\Services\InstructorAvailability;
use App\Services\SchedulingConstraints;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Agenda uma aula dentro da organização, atribuindo um instrutor com vínculo ativo e,
 * opcionalmente, um veículo. Confere conflito de instrutor, veículo e aluno.
 *
 * Agendar não exige a liberação para a prática (pré-reserva); concluir a aula exige.
 * Cada aula reserva seus minutos no saldo da matrícula; saldo insuficiente bloqueia, salvo
 * exceção autorizada com motivo, e matrícula sem pacote gera aviso (aula avulsa).
 */
class ScheduleLesson
{
    public function __construct(
        private readonly InstructorAvailability $availability,
        private readonly SchedulingConstraints $constraints,
        private readonly CreditLedger $ledger,
        private readonly Audit $audit,
    ) {}

    /** @var list<array{code: string, message: string}> Avisos de saldo da última execução. */
    public array $warnings = [];

    public function __invoke(
        Organization $organization,
        Enrollment $enrollment,
        int $instructorId,
        CarbonImmutable $startsAt,
        CarbonImmutable $endsAt,
        ?string $notes = null,
        ?int $vehicleId = null,
        ?string $category = null,
        ?string $overrideReason = null,
    ): Lesson {
        return DB::transaction(function () use ($organization, $enrollment, $instructorId, $startsAt, $endsAt, $notes, $vehicleId, $category, $overrideReason) {
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

            $vehicle = null;

            if ($vehicleId !== null) {
                $vehicle = $this->constraints->lockVehicle($vehicleId);
                $this->constraints->assertVehicleUsable($vehicle, $enrollment, $instructor, $startsAt, $organization->timezone);
                $this->constraints->assertVehicleAvailable($vehicleId, $startsAt, $endsAt);
            }

            $this->constraints->lockStudent($enrollment->student_id);
            $this->constraints->assertStudentAvailable($enrollment->student_id, $startsAt, $endsAt);

            // Ordem final de locks: ... → aluno → matrícula (saldo).
            $enrollment = Enrollment::query()->whereKey($enrollment->getKey())->lockForUpdate()->firstOrFail();

            $lessonCategory = $this->ledger->lessonCategory($enrollment, $vehicle, $category);
            $minutes = (int) $startsAt->diffInMinutes($endsAt);
            $this->warnings = $this->ledger->assertCanReserve($enrollment, $lessonCategory, $minutes, $overrideReason);

            $lesson = Lesson::create([
                'organization_id' => $organization->getKey(),
                'enrollment_id' => $enrollment->getKey(),
                'instructor_id' => $instructorId,
                'vehicle_id' => $vehicleId,
                'category' => $lessonCategory,
                'starts_at' => $startsAt->utc(),
                'ends_at' => $endsAt->utc(),
                'status' => LessonStatus::Scheduled,
                'notes' => $notes,
            ]);
            $lesson->setRelation('enrollment', $enrollment);

            $override = collect($this->warnings)->contains('code', 'insufficient_balance_override') ? $overrideReason : null;
            $this->ledger->reserve($lesson, $override);

            $this->audit->record($organization->getKey(), 'lesson.scheduled', 'Aula agendada.', [
                'enrollment_id' => $enrollment->getKey(),
                'student_id' => $enrollment->student_id,
                'process_id' => $enrollment->qualification_process_id,
                'subject' => $lesson,
                'changes' => ['starts_at' => $lesson->starts_at->toIso8601String(), 'minutes' => $minutes],
            ]);

            return $lesson;
        });
    }
}
