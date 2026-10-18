<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Fees\SaveExternalFee;
use App\Enums\FeeParty;
use App\Enums\FeeStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Fees\FeeRequest;
use App\Http\Requests\Fees\FeeStatusRequest;
use App\Http\Resources\ExternalFeeResource;
use App\Models\ExternalFee;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Taxas externas (guias de órgãos oficiais). Somente a equipe de operação.
 */
class ExternalFeeController extends Controller
{
    private const RELATIONS = ['exams:id', 'confirmer:id,name', 'student:id,name,phone'];

    public function index(Request $request, Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [ExternalFee::class, $organization]);

        $request->validate([
            'status' => ['nullable', Rule::enum(FeeStatus::class)],
            'reimbursement' => ['nullable', Rule::in(['none', 'to_settle', 'settled'])],
            'qualification_process_id' => ['nullable', 'integer'],
            'student_id' => ['nullable', 'integer'],
            'practical_exam_id' => ['nullable', 'integer'],
            'open' => ['nullable', 'boolean'],
        ]);

        $fees = ExternalFee::query()->where('organization_id', $organization->getKey())
            ->with(self::RELATIONS)
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('reimbursement'), fn ($q) => $q->where('reimbursement', $request->string('reimbursement')))
            ->when($request->filled('qualification_process_id'), fn ($q) => $q->where('qualification_process_id', $request->integer('qualification_process_id')))
            ->when($request->filled('student_id'), fn ($q) => $q->where('student_id', $request->integer('student_id')))
            ->when($request->filled('practical_exam_id'), fn ($q) => $q->whereHas('exams', fn ($e) => $e->where('practical_exams.id', $request->integer('practical_exam_id'))))
            ->when($request->boolean('open'), fn ($q) => $q->whereIn('status', ['unknown', 'pending', 'payment_reported']))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return ExternalFeeResource::collection($fees);
    }

    public function store(FeeRequest $request, Organization $organization, SaveExternalFee $save): JsonResponse
    {
        $this->authorize('manage', [ExternalFee::class, $organization]);

        return $this->respond($save->create($organization, $request->validated()), 201);
    }

    public function show(Organization $organization, ExternalFee $externalFee): JsonResponse
    {
        $this->authorize('view', [$externalFee, $organization]);

        return $this->respond($externalFee);
    }

    public function update(FeeRequest $request, Organization $organization, ExternalFee $externalFee, SaveExternalFee $save): JsonResponse
    {
        $this->authorize('manage', [ExternalFee::class, $organization]);

        return $this->respond($save->update($externalFee, $request->validated()));
    }

    public function status(FeeStatusRequest $request, Organization $organization, ExternalFee $externalFee, SaveExternalFee $save): JsonResponse
    {
        $this->authorize('manage', [ExternalFee::class, $organization]);

        $paidBy = $request->validated('paid_by');

        return $this->respond($save->changeStatus(
            $externalFee,
            FeeStatus::from($request->validated('status')),
            $request->validated('reason'),
            $request->validated('confirmation_source'),
            $paidBy ? FeeParty::from($paidBy) : null,
        ));
    }

    public function reimbursement(Organization $organization, ExternalFee $externalFee, SaveExternalFee $save): JsonResponse
    {
        $this->authorize('manage', [ExternalFee::class, $organization]);

        return $this->respond($save->settleReimbursement($externalFee));
    }

    private function respond(ExternalFee $fee, int $status = 200): JsonResponse
    {
        return (new ExternalFeeResource($fee->load(self::RELATIONS)))->response()->setStatusCode($status);
    }
}
