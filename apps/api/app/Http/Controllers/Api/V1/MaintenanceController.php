<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Availability\SaveMaintenance;
use App\Http\Controllers\Controller;
use App\Http\Requests\Availability\MaintenanceRequest;
use App\Http\Resources\VehicleMaintenanceResource;
use App\Models\AvailabilityBlock;
use App\Models\Organization;
use App\Models\Vehicle;
use App\Models\VehicleMaintenance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Manutenção de veículos (custos e documentos: somente a equipe de operação).
 */
class MaintenanceController extends Controller
{
    private const RELATIONS = ['vehicle:id,plate,model', 'block'];

    public function index(Request $request, Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('operate', [AvailabilityBlock::class, $organization]);

        $request->validate([
            'vehicle_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(['scheduled', 'done', 'cancelled'])],
        ]);

        $items = $organization->maintenances()
            ->with(self::RELATIONS)
            ->when($request->filled('vehicle_id'), fn ($q) => $q->where('vehicle_id', $request->integer('vehicle_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->orderByDesc('scheduled_on')->orderByDesc('id')
            ->paginate($this->perPage($request));

        return VehicleMaintenanceResource::collection($items);
    }

    public function store(MaintenanceRequest $request, Organization $organization, SaveMaintenance $save): JsonResponse
    {
        $this->authorize('operate', [AvailabilityBlock::class, $organization]);

        $vehicle = Vehicle::query()->where('organization_id', $organization->getKey())->findOrFail($request->integer('vehicle_id'));
        $result = $save->create($organization, $vehicle, $request->validated());

        return (new VehicleMaintenanceResource($result['maintenance']->load(self::RELATIONS)))
            ->additional(['meta' => ['affected' => $result['affected']]])
            ->response()->setStatusCode(201);
    }

    public function show(Organization $organization, VehicleMaintenance $maintenance): JsonResponse
    {
        $this->authorize('operate', [AvailabilityBlock::class, $organization]);

        return (new VehicleMaintenanceResource($maintenance->load(self::RELATIONS)))->response();
    }

    public function update(MaintenanceRequest $request, Organization $organization, VehicleMaintenance $maintenance, SaveMaintenance $save): JsonResponse
    {
        $this->authorize('operate', [AvailabilityBlock::class, $organization]);

        return (new VehicleMaintenanceResource($save->update($maintenance, $request->validated())->load(self::RELATIONS)))->response();
    }

    public function complete(MaintenanceRequest $request, Organization $organization, VehicleMaintenance $maintenance, SaveMaintenance $save): JsonResponse
    {
        $this->authorize('operate', [AvailabilityBlock::class, $organization]);

        return (new VehicleMaintenanceResource($save->complete($maintenance, $request->validated())->load(self::RELATIONS)))->response();
    }

    public function cancel(Request $request, Organization $organization, VehicleMaintenance $maintenance, SaveMaintenance $save): JsonResponse
    {
        $this->authorize('operate', [AvailabilityBlock::class, $organization]);

        $request->validate(['reason' => ['nullable', 'string', 'max:255']]);

        return (new VehicleMaintenanceResource($save->cancel($maintenance, $request->input('reason'))->load(self::RELATIONS)))->response();
    }
}
