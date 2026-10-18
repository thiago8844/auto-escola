<?php

namespace App\Services;

use App\Enums\LicenseCategory;
use App\Exceptions\BusinessRuleException;
use App\Models\Organization;
use App\Models\PracticalExam;
use App\Models\QualificationProcess;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Regras compartilhadas de agendamento de exames: validações do percurso e conflitos de
 * instrutor, veículo e aluno (aulas e outros exames). Deve rodar dentro de uma transação.
 *
 * Ordem de locks (igual à das aulas): instrutor → veículo → aluno.
 */
class ExamPlanner
{
    public function __construct(
        private readonly InstructorAvailability $availability,
        private readonly SchedulingConstraints $constraints,
        private readonly AvailabilityGuard $guard,
    ) {}

    /**
     * Garante instrutor/veículo/aluno livres na bloco do exame [início, início + PracticalExam::SLOT_MINUTES).
     */
    public function assertResourcesFree(
        Organization $organization,
        int $studentId,
        ?int $instructorId,
        ?int $vehicleId,
        CarbonImmutable $startsAt,
        ?int $ignoreExamId = null,
    ): void {
        $startsAt = $startsAt->utc();
        $endsAt = $startsAt->addMinutes(PracticalExam::SLOT_MINUTES);

        if ($instructorId !== null) {
            $instructor = $this->availability->lockInstructor($instructorId);

            $linkActive = $organization->instructors()->whereKey($instructorId)->wherePivot('active', true)->exists();

            if (! $linkActive) {
                throw new BusinessRuleException('Este instrutor não está ativo nesta organização.', 'instructor_inactive', 422);
            }

            $this->availability->assertAvailable($instructorId, $startsAt, $endsAt, ignoreExamId: $ignoreExamId);
            $this->guard->assertInstructorNotBlocked($organization, $instructor, $startsAt, $endsAt);
        }

        if ($vehicleId !== null) {
            $vehicle = $this->constraints->lockVehicle($vehicleId);

            if ($vehicle->status->value !== 'active') {
                throw new BusinessRuleException('Este veículo está inativo.', 'vehicle_inactive', 422);
            }

            $this->constraints->assertVehicleAvailable($vehicleId, $startsAt, $endsAt, ignoreExamId: $ignoreExamId);
            $this->guard->assertVehicleNotBlocked($vehicle, $startsAt, $endsAt, $organization->timezone ?: config('autoescola.default_timezone'));
        }

        $this->constraints->lockStudent($studentId);
        $this->constraints->assertStudentAvailable($studentId, $startsAt, $endsAt, ignoreExamId: $ignoreExamId);
    }

    /**
     * A inscrição no exame leva a autoescola. Nulo é o próprio espaço, que só vale em autoescola:
     * no espaço particular de instrutor é preciso indicar a parceira.
     */
    public function assertDrivingSchool(Organization $organization, ?int $partnerId): void
    {
        if ($partnerId === null && $organization->type !== \App\Enums\OrganizationType::Cfc) {
            throw new BusinessRuleException('Informe a autoescola do exame.', 'driving_school_required', 422);
        }
    }

    /**
     * Categoria simples do exame, dentro das pretendidas do processo.
     */
    public function assertCategoryInProcess(QualificationProcess $process, string $category): void
    {
        $allowed = collect($process->targetCategoryEnums())
            ->flatMap(fn (LicenseCategory $c) => $c->components())
            ->map->value->all();

        if (! in_array($category, $allowed, true)) {
            throw new BusinessRuleException('A categoria não está entre as pretendidas do processo.', 'exam_category_invalid', 422);
        }
    }

    /**
     * Próximo número da tentativa do percurso. O processo deve estar travado pelo chamador:
     * duas criações concorrentes se enfileiram e a chave única é a última barreira.
     */
    public function nextAttemptNumber(QualificationProcess $process, string $category): int
    {
        return (int) PracticalExam::query()
            ->where('qualification_process_id', $process->getKey())
            ->where('category', $category)
            ->max('attempt_number') + 1;
    }

    public function lockProcess(int $processId): QualificationProcess
    {
        if (DB::transactionLevel() === 0) {
            throw new \LogicException('Deve rodar dentro de uma transação.');
        }

        return QualificationProcess::query()->whereKey($processId)->lockForUpdate()->firstOrFail();
    }
}
