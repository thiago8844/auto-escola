<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Students\StudentRequest;
use App\Http\Resources\StudentResource;
use App\Exceptions\BusinessRuleException;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\PracticalExam;
use App\Services\Audit;
use App\Models\Student;
use App\Services\AssignmentScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class StudentController extends Controller
{
    public function index(Request $request, Organization $organization, AssignmentScope $scope): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [Student::class, $organization]);

        $query = $this->isOperator($request)
            ? $organization->students()
            : $this->assignedOnly($request, $organization, $scope);

        // Arquivados: só a equipe consulta; o histórico continua ligado a eles.
        if ($this->isOperator($request) && $request->boolean('archived')) {
            $query->onlyTrashed();
        }

        $students = $query
            ->when($request->filled('search'), fn ($q) => $q->where('name', 'like', '%'.$request->string('search').'%'))
            ->orderBy('name')
            ->paginate($this->perPage($request));

        return StudentResource::collection($students);
    }

    public function store(StudentRequest $request, Organization $organization): JsonResponse
    {
        $this->authorize('create', [Student::class, $organization]);

        $student = $organization->students()->create($request->validated());

        return (new StudentResource($student))->response()->setStatusCode(201);
    }

    public function show(Request $request, Organization $organization, Student $student): JsonResponse
    {
        $this->authorize('view', [$student, $organization]);

        return (new StudentResource($student))->response();
    }

    public function update(StudentRequest $request, Organization $organization, Student $student): JsonResponse
    {
        $this->authorize('update', [$student, $organization]);

        app(\App\Services\StaleGuard::class)->assertFresh($student, $request);

        $student->update($request->validated());

        return (new StudentResource($student->refresh()))->response();
    }

    /**
     * Arquivar tira o aluno da operação sem apagar nada: matrículas, aulas, saldo, exames e documentos ficam
     * no histórico. Não arquiva quem ainda tem aula/exame agendado ou matrícula em andamento: resolva antes.
     * O CPF continua reservado ao cadastro arquivado (restaurar em vez de cadastrar de novo).
     */
    public function destroy(Organization $organization, Student $student, Audit $audit): Response
    {
        $this->authorize('delete', [$student, $organization]);

        $scheduledLessons = Lesson::query()->where('organization_id', $organization->getKey())
            ->where('status', 'scheduled')->whereHas('enrollment', fn ($q) => $q->where('student_id', $student->getKey()))->count();
        $scheduledExams = PracticalExam::query()->where('organization_id', $organization->getKey())
            ->where('status', 'scheduled')->where('student_id', $student->getKey())->count();
        $openEnrollments = $student->enrollments()->whereIn('status', ['prospect', 'contracted', 'in_service'])->count();

        if ($scheduledLessons + $scheduledExams > 0) {
            throw new BusinessRuleException(
                "Este aluno tem {$scheduledLessons} aula(s) e {$scheduledExams} exame(s) agendados. Conclua, cancele ou remarque antes de arquivar.",
                'student_has_commitments',
                422,
            );
        }

        if ($openEnrollments > 0) {
            throw new BusinessRuleException(
                "Este aluno tem {$openEnrollments} matrícula(s) em andamento. Encerre ou rescinda antes de arquivar.",
                'student_has_open_enrollments',
                422,
            );
        }

        $student->delete();
        $audit->record($organization->getKey(), 'student.archived', "Aluno {$student->name} arquivado.", ['student_id' => $student->getKey(), 'subject' => $student]);

        return response()->noContent();
    }

    public function restore(Organization $organization, Student $student, Audit $audit): JsonResponse
    {
        $this->authorize('delete', [$student, $organization]);

        $student->restore();
        $audit->record($organization->getKey(), 'student.restored', "Aluno {$student->name} restaurado.", ['student_id' => $student->getKey(), 'subject' => $student]);

        return (new StudentResource($student->refresh()))->response();
    }

    /**
     * Instrutor sem perfil profissional não vê nada: a consulta retorna vazia.
     */
    private function assignedOnly(Request $request, Organization $organization, AssignmentScope $scope)
    {
        $instructor = $request->user()->instructor;

        return $instructor
            ? $scope->studentsFor($organization, $instructor)
            : $organization->students()->whereRaw('0 = 1');
    }
}
