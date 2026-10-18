<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Enrollments\EnrollmentRequest;
use App\Http\Resources\EnrollmentResource;
use App\Models\Enrollment;
use App\Models\Organization;
use App\Actions\Enrollments\UpdateEnrollment;
use App\Services\Audit;
use App\Services\AssignmentScope;
use App\Services\CreditLedger;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class EnrollmentController extends Controller
{
    private const RELATIONS = ['student', 'partner', 'process.checklistItems'];

    public function index(Request $request, Organization $organization, AssignmentScope $scope, CreditLedger $ledger): AnonymousResourceCollection
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

        // Saldos da página calculados em lote (sem consulta por matrícula).
        $request->attributes->set('credit_balances', $ledger->balancesFor($enrollments->items()));

        return EnrollmentResource::collection($enrollments);
    }

    public function store(EnrollmentRequest $request, Organization $organization, CreditLedger $ledger, Audit $audit): JsonResponse
    {
        $this->authorize('create', [Enrollment::class, $organization]);

        $enrollment = DB::transaction(function () use ($request, $organization, $ledger, $audit) {
            $enrollment = $organization->enrollments()->create($request->validated());

            // Minutos informados na criação viram a primeira contratação do extrato.
            if ($enrollment->contracted_minutes) {
                $ledger->grant($enrollment, [
                    'description' => 'Contratação inicial',
                    'minutes' => $enrollment->contracted_minutes,
                    'price_cents' => $enrollment->price_cents,
                ]);
            }

            $audit->record($organization->getKey(), 'enrollment.created', "Matrícula criada na categoria {$enrollment->category->value}.", [
                'enrollment_id' => $enrollment->getKey(),
                'student_id' => $enrollment->student_id,
                'process_id' => $enrollment->qualification_process_id,
                'subject' => $enrollment,
            ]);

            return $enrollment;
        });

        return (new EnrollmentResource($enrollment->load(self::RELATIONS)))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Organization $organization, Enrollment $enrollment): JsonResponse
    {
        $this->authorize('view', [$enrollment, $organization]);

        return (new EnrollmentResource($enrollment->load(self::RELATIONS)))->response();
    }

    public function update(EnrollmentRequest $request, Organization $organization, Enrollment $enrollment, UpdateEnrollment $update): JsonResponse
    {
        $this->authorize('update', [$enrollment, $organization]);

        $update($enrollment, $request->validated());

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
