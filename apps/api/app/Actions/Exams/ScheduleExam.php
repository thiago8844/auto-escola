<?php

namespace App\Actions\Exams;

use App\Enums\ExamStatus;
use App\Enums\ProcessStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Enrollment;
use App\Models\Organization;
use App\Models\PracticalExam;
use App\Models\ProcessCategoryTrack;
use App\Models\QualificationProcess;
use App\Services\Audit;
use App\Services\ExamPlanner;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Cria uma nova tentativa de exame prático para um percurso (processo + categoria simples).
 * Nunca sobrescreve tentativa anterior: o número cresce sob lock do processo.
 */
class ScheduleExam
{
    public function __construct(private readonly ExamPlanner $planner, private readonly Audit $audit) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function __invoke(Organization $organization, array $data): PracticalExam
    {
        try {
            return DB::transaction(fn () => $this->create($organization, $data));
        } catch (UniqueConstraintViolationException) {
            throw new BusinessRuleException('Outra tentativa foi criada ao mesmo tempo. Tente novamente.', 'exam_attempt_conflict', 409);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function create(Organization $organization, array $data): PracticalExam
    {
        $startsAt = CarbonImmutable::parse($data['scheduled_at']);
        $duration = (int) ($data['duration_minutes'] ?? 60);
        $category = $data['category'];

        $instructorId = $data['instructor_id'] ?? null;
        $vehicleId = $data['vehicle_id'] ?? null;

        // Instrutor → veículo → aluno (ordem de locks), depois o processo.
        $process = QualificationProcess::query()->where('organization_id', $organization->getKey())
            ->findOrFail($data['qualification_process_id']);

        $this->planner->assertResourcesFree($organization, $process->student_id, $instructorId, $vehicleId, $startsAt, $duration);

        $process = $this->planner->lockProcess($process->getKey());

        if (in_array($process->status, [ProcessStatus::Completed, ProcessStatus::Closed], true)) {
            throw new BusinessRuleException('O processo está encerrado. Reabra-o para registrar novos exames.', 'process_closed', 422);
        }

        $this->planner->assertCategoryInProcess($process, $category);

        if (ProcessCategoryTrack::query()->where('qualification_process_id', $process->getKey())
            ->where('category', $category)->whereNotNull('renounced_at')->exists()) {
            throw new BusinessRuleException("A categoria {$category} foi renunciada neste processo.", 'category_renounced', 422);
        }

        $existing = PracticalExam::query()
            ->where('qualification_process_id', $process->getKey())
            ->where('category', $category);

        if ((clone $existing)->where('status', ExamStatus::Approved->value)->exists()) {
            throw new BusinessRuleException("A categoria {$category} já foi aprovada neste processo.", 'category_already_approved', 422);
        }

        if ((clone $existing)->where('status', ExamStatus::Scheduled->value)->exists()) {
            throw new BusinessRuleException(
                "Já existe uma tentativa agendada para a categoria {$category}. Remarque-a ou registre o resultado antes de criar outra.",
                'exam_already_scheduled',
                422,
            );
        }

        if (! empty($data['enrollment_id'])) {
            $enrollment = Enrollment::query()->where('organization_id', $organization->getKey())->findOrFail($data['enrollment_id']);

            if ($enrollment->qualification_process_id !== $process->getKey()
                || ! collect($enrollment->category->components())->contains(fn ($c) => $c->value === $category)) {
                throw new BusinessRuleException('A matrícula não pertence a este percurso.', 'exam_enrollment_invalid', 422);
            }
        }

        $exam = PracticalExam::create([
            'organization_id' => $organization->getKey(),
            'qualification_process_id' => $process->getKey(),
            'student_id' => $process->student_id,
            'enrollment_id' => $data['enrollment_id'] ?? null,
            'category' => $category,
            'attempt_number' => $this->planner->nextAttemptNumber($process, $category),
            'scheduled_at' => $startsAt->utc(),
            'duration_minutes' => $duration,
            'location' => $data['location'] ?? null,
            'protocol' => $data['protocol'] ?? null,
            'notes' => $data['notes'] ?? null,
            'instructor_id' => $instructorId,
            'vehicle_id' => $vehicleId,
            'created_by' => auth()->id(),
        ]);

        $this->audit->record($organization->getKey(), 'exam.scheduled',
            "Exame da categoria {$category} agendado (tentativa {$exam->attempt_number}).", [
                'student_id' => $process->student_id,
                'process_id' => $process->getKey(),
                'enrollment_id' => $exam->enrollment_id,
                'subject' => $exam,
                'changes' => ['scheduled_at' => $exam->scheduled_at->toIso8601String(), 'location' => $exam->location],
            ]);

        return $exam;
    }
}
