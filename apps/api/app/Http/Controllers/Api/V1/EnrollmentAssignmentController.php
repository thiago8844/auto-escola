<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\LicenseCategory;
use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Enrollments\AssignmentRequest;
use App\Http\Resources\EnrollmentResource;
use App\Models\Enrollment;
use App\Models\Organization;
use App\Services\Audit;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Encaminha o atendimento sem reservar horário, movimentar saldo ou conceder permissões de agenda. */
class EnrollmentAssignmentController extends Controller
{
    public function __invoke(AssignmentRequest $request, Organization $organization, Enrollment $enrollment, Audit $audit): JsonResponse
    {
        $this->authorize('update', [$enrollment, $organization]);
        $input = $request->validated();

        DB::transaction(function () use ($organization, $enrollment, $audit, $input): void {
            $locked = $organization->enrollments()->whereKey($enrollment->getKey())->lockForUpdate()->firstOrFail();
            if ($locked->assigned_instructor_id != $input['expected_instructor_id']) {
                throw new BusinessRuleException('O encaminhamento foi alterado por outra pessoa. Atualize a matrícula antes de tentar novamente.', 'stale_assignment', 409);
            }
            $instructor = null;
            if ($input['instructor_id'] !== null) {
                if (! $locked->status->acceptsLessons()) {
                    throw ValidationException::withMessages(['instructor_id' => 'Reabra a matrícula antes de encaminhar o aluno.']);
                }
                $instructor = $organization->instructors()->wherePivot('active', true)->whereKey($input['instructor_id'])->first();
                if ($instructor === null) {
                    throw ValidationException::withMessages(['instructor_id' => 'Escolha um instrutor ativo deste espaço.']);
                }
                $covered = collect($instructor->categories ?? [])->flatMap(fn (string $category) => LicenseCategory::from($category)->components())->map->value->all();
                $needed = collect($locked->category->components())->map->value->all();
                if (array_intersect($needed, $covered) === []) {
                    throw ValidationException::withMessages(['instructor_id' => 'O instrutor não atende a categoria desta matrícula.']);
                }
            }
            if ($locked->assigned_instructor_id == $input['instructor_id']) {
                return;
            }
            $previous = $locked->assigned_instructor_id;
            $locked->assigned_instructor_id = $instructor?->getKey();
            $locked->assigned_at = $instructor ? now() : null;
            $locked->save();
            $audit->record($organization->getKey(), 'enrollment.assigned', $instructor ? "Aluno encaminhado para {$instructor->full_name}." : 'Encaminhamento removido.', [
                'student_id' => $locked->student_id,
                'enrollment_id' => $locked->getKey(),
                'subject' => $locked,
                'changes' => ['instructor_id' => ['before' => $previous, 'after' => $locked->assigned_instructor_id]],
            ]);
        });

        return (new EnrollmentResource($enrollment->refresh()->load(['student', 'partner', 'process.checklistItems', 'assignedInstructor'])))->response();
    }
}
