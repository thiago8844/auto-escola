<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Enrollments\EnrollmentRequest;
use App\Http\Resources\EnrollmentResource;
use App\Models\Enrollment;
use App\Models\Organization;
use App\Services\AssignmentScope;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EnrollmentController extends Controller
{
    private const RELATIONS = ['student', 'partner', 'process.checklistItems'];

    public function index(Request $request, Organization $organization, AssignmentScope $scope): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [Enrollment::class, $organization]);

        $query = $this->isOperator($request)
            ? $organization->enrollments()
            : $this->assignedOnly($request, $organization, $scope);

        $enrollments = $query
            ->when($request->filled('student_id'), fn ($q) => $q->where('student_id', $request->integer('student_id')))
            ->with(self::RELATIONS)
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return EnrollmentResource::collection($enrollments);
    }

    public function store(EnrollmentRequest $request, Organization $organization): JsonResponse
    {
        $this->authorize('create', [Enrollment::class, $organization]);

        $enrollment = $organization->enrollments()->create($request->validated());

        return (new EnrollmentResource($enrollment->load(self::RELATIONS)))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Organization $organization, Enrollment $enrollment): JsonResponse
    {
        $this->authorize('view', [$enrollment, $organization]);

        return (new EnrollmentResource($enrollment->load(self::RELATIONS)))->response();
    }

    public function update(EnrollmentRequest $request, Organization $organization, Enrollment $enrollment): JsonResponse
    {
        $this->authorize('update', [$enrollment, $organization]);

        $enrollment->update($request->validated());

        return (new EnrollmentResource($enrollment->refresh()->load(self::RELATIONS)))->response();
    }

    private function assignedOnly(Request $request, Organization $organization, AssignmentScope $scope)
    {
        $instructor = $request->user()->instructor;

        return $instructor
            ? $scope->enrollmentsFor($organization, $instructor)
            : $organization->enrollments()->whereRaw('0 = 1');
    }
}
