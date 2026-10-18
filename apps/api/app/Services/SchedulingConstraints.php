<?php

namespace App\Services;

use App\Enums\LessonStatus;
use App\Enums\LicenseCategory;
use App\Enums\VehicleStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Enrollment;
use App\Models\Instructor;
use App\Models\Lesson;
use App\Models\PracticalExam;
use App\Models\Student;
use App\Models\Vehicle;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Restrições de agenda além do instrutor (ver InstructorAvailability): veículo e aluno.
 *
 * Mesma estratégia de concorrência: lock pessimista na linha do veículo e do aluno antes
 * de checar. Para evitar deadlock a ordem é SEMPRE instrutor → veículo → aluno.
 * Deve ser chamada dentro de uma transação.
 */
class SchedulingConstraints
{
    public function lockVehicle(int $vehicleId): Vehicle
    {
        return Vehicle::query()->whereKey($vehicleId)->lockForUpdate()->firstOrFail();
    }

    public function lockStudent(int $studentId): void
    {
        Student::withTrashed()->whereKey($studentId)->lockForUpdate()->firstOrFail();
    }

    /**
     * Veículo ativo, com CRLV válido no dia da aula (no fuso do espaço) e compatível
     * com a categoria da matrícula e com as categorias do instrutor.
     */
    public function assertVehicleUsable(
        Vehicle $vehicle,
        Enrollment $enrollment,
        Instructor $instructor,
        CarbonInterface $startsAt,
        string $timezone,
    ): void {
        if ($vehicle->status !== VehicleStatus::Active) {
            throw new BusinessRuleException('Este veículo está inativo.', 'vehicle_inactive', 422);
        }

        if ($vehicle->crlv_expires_at !== null) {
            $lessonDay = $startsAt->setTimezone($timezone)->toDateString();

            if ($vehicle->crlv_expires_at->toDateString() < $lessonDay) {
                throw new BusinessRuleException(
                    'O CRLV deste veículo estará vencido na data da aula.',
                    'vehicle_document_expired',
                    422,
                );
            }
        }

        if (! $enrollment->category->covers($vehicle->category)) {
            throw new BusinessRuleException(
                'A categoria do veículo não é compatível com a matrícula.',
                'vehicle_category_mismatch',
                422,
            );
        }

        // Instrutor sem categorias cadastradas não é bloqueado: o cadastro pode estar incompleto.
        $instructorCategories = array_filter(array_map(
            fn (string $c) => LicenseCategory::tryFrom($c),
            $instructor->categories ?? [],
        ));

        if ($instructorCategories !== []
            && ! collect($instructorCategories)->contains(fn (LicenseCategory $c) => $c->covers($vehicle->category))) {
            throw new BusinessRuleException(
                'O instrutor não atende a categoria deste veículo.',
                'instructor_category_mismatch',
                422,
            );
        }
    }

    public function assertVehicleAvailable(
        int $vehicleId,
        CarbonInterface $startsAt,
        CarbonInterface $endsAt,
        ?int $ignoreLessonId = null,
        ?int $ignoreExamId = null,
    ): void {
        $this->assertInTransaction();

        $conflict = Lesson::query()
            ->where('vehicle_id', $vehicleId)
            ->where('status', LessonStatus::Scheduled->value)
            ->when($ignoreLessonId, fn ($q) => $q->whereKeyNot($ignoreLessonId))
            ->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt)
            ->exists()
            || $this->examOverlap(PracticalExam::query()->where('vehicle_id', $vehicleId), $startsAt, $endsAt, $ignoreExamId);

        if ($conflict) {
            throw new BusinessRuleException('Veículo indisponível nesse horário.', 'vehicle_unavailable', 409);
        }
    }

    /**
     * Um aluno não faz duas aulas ao mesmo tempo, em qualquer uma de suas matrículas (ex.: AB).
     */
    public function assertStudentAvailable(
        int $studentId,
        CarbonInterface $startsAt,
        CarbonInterface $endsAt,
        ?int $ignoreLessonId = null,
        ?int $ignoreExamId = null,
    ): void {
        $this->assertInTransaction();

        $conflict = Lesson::query()
            ->whereHas('enrollment', fn ($q) => $q->where('student_id', $studentId))
            ->where('status', LessonStatus::Scheduled->value)
            ->when($ignoreLessonId, fn ($q) => $q->whereKeyNot($ignoreLessonId))
            ->where('starts_at', '<', $endsAt)
            ->where('ends_at', '>', $startsAt)
            ->exists()
            || $this->examOverlap(PracticalExam::query()->where('student_id', $studentId), $startsAt, $endsAt, $ignoreExamId);

        if ($conflict) {
            throw new BusinessRuleException('O aluno já tem uma aula nesse horário.', 'student_unavailable', 409);
        }
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<PracticalExam>  $query
     */
    private function examOverlap($query, CarbonInterface $startsAt, CarbonInterface $endsAt, ?int $ignoreExamId): bool
    {
        return $query
            ->where('status', 'scheduled')
            ->when($ignoreExamId, fn ($q) => $q->whereKeyNot($ignoreExamId))
            ->where('scheduled_at', '<', $endsAt)
            ->whereRaw('DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?', [$startsAt])
            ->exists();
    }

    private function assertInTransaction(): void
    {
        if (DB::transactionLevel() === 0) {
            throw new \LogicException('A verificação de disponibilidade deve rodar dentro de uma transação.');
        }
    }
}
