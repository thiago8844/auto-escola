<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vehicles\VehicleRequest;
use App\Http\Resources\VehicleResource;
use App\Models\Organization;
use App\Exceptions\BusinessRuleException;
use App\Models\Vehicle;
use App\Services\CommitmentFinder;
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
            ->when($request->boolean('archived'), fn ($q) => $q->onlyTrashed())
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

        app(\App\Services\StaleGuard::class)->assertFresh($vehicle, $request);

        $previousCrlv = $vehicle->crlv_expires_at?->toDateString();
        $wasActive = $vehicle->status->value === 'active';

        $vehicle->update($request->validated());
        $vehicle->refresh();

        // Inativar ou antecipar o vencimento do CRLV não cancela nada: a equipe recebe a lista dos
        // compromissos futuros afetados e decide cada um (trocar veículo, remarcar ou cancelar).
        $affected = [];
        $finder = app(CommitmentFinder::class);

        if ($wasActive && $vehicle->status->value !== 'active') {
            $affected = $finder->find($organization, $vehicle->getKey(), null, now());
        } elseif ($vehicle->crlv_expires_at !== null && $vehicle->crlv_expires_at->toDateString() !== $previousCrlv) {
            $timezone = $organization->timezone ?: config('autoescola.default_timezone');
            $affected = $finder->find(
                $organization,
                $vehicle->getKey(),
                null,
                $vehicle->crlv_expires_at->copy()->addDay()->startOfDay()->shiftTimezone($timezone)->utc(),
            );
        }

        return (new VehicleResource($vehicle))->additional(['meta' => ['affected' => $affected]])->response();
    }

    /**
     * Exclusão lógica: aulas antigas continuam referenciando o veículo.
     */
    public function destroy(Organization $organization, Vehicle $vehicle): Response
    {
        $this->authorize('delete', [$vehicle, $organization]);

        $pending = count(app(CommitmentFinder::class)->find($organization, $vehicle->getKey(), null, now()));

        if ($pending > 0) {
            throw new BusinessRuleException(
                "Este veículo tem {$pending} compromisso(s) futuro(s). Troque o veículo ou remarque antes de excluir.",
                'vehicle_has_commitments',
                422,
            );
        }

        $vehicle->delete();
        app(\App\Services\Audit::class)->record($organization->getKey(), 'vehicle.archived', "Veículo {$vehicle->plate} arquivado.", ['subject' => $vehicle]);

        return response()->noContent();
    }

    /**
     * Restaura um veículo arquivado. A placa continua reservada ao cadastro arquivado.
     */
    public function restore(Organization $organization, Vehicle $vehicle): JsonResponse
    {
        $this->authorize('delete', [$vehicle, $organization]);

        $vehicle->restore();
        app(\App\Services\Audit::class)->record($organization->getKey(), 'vehicle.restored', "Veículo {$vehicle->plate} restaurado.", ['subject' => $vehicle]);

        return (new VehicleResource($vehicle->refresh()))->response();
    }
}
