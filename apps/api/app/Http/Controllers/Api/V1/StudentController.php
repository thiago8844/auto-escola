<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Students\StudentRequest;
use App\Http\Resources\StudentResource;
use App\Models\Organization;
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

        $student->update($request->validated());

        return (new StudentResource($student->refresh()))->response();
    }

    /**
     * Exclusão lógica: preserva o histórico de matrículas e aulas do aluno.
     */
    public function destroy(Organization $organization, Student $student): Response
    {
        $this->authorize('delete', [$student, $organization]);

        $student->delete();

        return response()->noContent();
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
