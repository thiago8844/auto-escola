<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vehicles\VehicleRequest;
use App\Http\Resources\VehicleResource;
use App\Models\Organization;
use App\Models\Vehicle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class VehicleController extends Controller
{
    public function index(Request $request, Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [Vehicle::class, $organization]);

        $vehicles = $organization->vehicles()
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('category'), fn ($q) => $q->where('category', $request->string('category')))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%'.$request->string('search').'%';
                $q->where(fn ($w) => $w->where('plate', 'like', $term)->orWhere('model', 'like', $term));
            })
            ->orderBy('plate')
            ->paginate($this->perPage($request));

        return VehicleResource::collection($vehicles);
    }

    public function store(VehicleRequest $request, Organization $organization): JsonResponse
    {
        $this->authorize('create', [Vehicle::class, $organization]);

        $vehicle = $organization->vehicles()->create($request->validated());

        return (new VehicleResource($vehicle->refresh()))->response()->setStatusCode(201);
    }

    public function show(Organization $organization, Vehicle $vehicle): JsonResponse
    {
        $this->authorize('view', [$vehicle, $organization]);

        return (new VehicleResource($vehicle))->response();
    }

    public function update(VehicleRequest $request, Organization $organization, Vehicle $vehicle): JsonResponse
    {
        $this->authorize('update', [$vehicle, $organization]);

        $vehicle->update($request->validated());

        return (new VehicleResource($vehicle->refresh()))->response();
    }

    /**
     * Exclusão lógica: aulas antigas continuam referenciando o veículo.
     */
    public function destroy(Organization $organization, Vehicle $vehicle): Response
    {
        $this->authorize('delete', [$vehicle, $organization]);

        $vehicle->delete();

        return response()->noContent();
    }
}
