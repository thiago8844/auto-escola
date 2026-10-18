<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Enrollments\AdjustBalanceRequest;
use App\Http\Requests\Enrollments\ReverseEntryRequest;
use App\Http\Requests\Enrollments\StorePackageRequest;
use App\Http\Resources\CreditEntryResource;
use App\Http\Resources\EnrollmentPackageResource;
use App\Models\CreditEntry;
use App\Models\Enrollment;
use App\Models\Organization;
use App\Services\CreditLedger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Saldo, extrato e movimentos de minutos de uma matrícula. Leitura e contratação: equipe de
 * operação. Ajuste e estorno: proprietário e administrador, sempre com motivo.
 */
class EnrollmentBalanceController extends Controller
{
    public function __construct(private readonly CreditLedger $ledger) {}

    public function show(Organization $organization, Enrollment $enrollment): JsonResponse
    {
        $this->authorize('viewBalance', [$enrollment, $organization]);

        return response()->json(['data' => $this->payload($enrollment)]);
    }

    public function entries(Request $request, Organization $organization, Enrollment $enrollment): AnonymousResourceCollection
    {
        $this->authorize('viewBalance', [$enrollment, $organization]);

        $request->validate(['type' => ['nullable', 'string'], 'category' => ['nullable', 'string']]);

        return CreditEntryResource::collection(
            $enrollment->creditEntries()
                ->with('actor:id,name')
                ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
                ->when($request->filled('category'), fn ($q) => $q->where('category', $request->string('category')))
                ->orderByDesc('id')
                ->paginate($this->perPage($request)),
        );
    }

    public function storePackage(StorePackageRequest $request, Organization $organization, Enrollment $enrollment): JsonResponse
    {
        $this->authorize('contract', [$enrollment, $organization]);

        DB::transaction(function () use ($request, $enrollment) {
            $locked = Enrollment::query()->whereKey($enrollment->getKey())->lockForUpdate()->firstOrFail();
            $this->ledger->grant($locked, $request->validated());
        });

        return response()->json(['data' => $this->payload($enrollment)], 201);
    }

    public function adjust(AdjustBalanceRequest $request, Organization $organization, Enrollment $enrollment): JsonResponse
    {
        $this->authorize('adjustBalance', [$enrollment, $organization]);

        DB::transaction(function () use ($request, $enrollment) {
            $locked = Enrollment::query()->whereKey($enrollment->getKey())->lockForUpdate()->firstOrFail();
            $this->ledger->adjust($locked, $request->integer('minutes'), $request->validated('category'), $request->validated('reason'));
        });

        return response()->json(['data' => $this->payload($enrollment)], 201);
    }

    public function reverse(
        ReverseEntryRequest $request,
        Organization $organization,
        Enrollment $enrollment,
        CreditEntry $creditEntry,
    ): JsonResponse {
        $this->authorize('adjustBalance', [$enrollment, $organization]);

        DB::transaction(function () use ($request, $enrollment, $creditEntry) {
            $locked = Enrollment::query()->whereKey($enrollment->getKey())->lockForUpdate()->firstOrFail();
            $this->ledger->reverse($locked, $creditEntry, $request->validated('reason'));
        });

        return response()->json(['data' => $this->payload($enrollment)], 201);
    }

    /** @return array<string, mixed> */
    private function payload(Enrollment $enrollment): array
    {
        return $this->ledger->balanceFor($enrollment) + [
            'packages' => EnrollmentPackageResource::collection(
                $enrollment->packages()->orderByDesc('id')->get(),
            )->resolve(),
        ];
    }
}
