<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Partners\PartnerRequest;
use App\Http\Resources\PartnerResource;
use App\Models\Organization;
use App\Models\Partner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class PartnerController extends Controller
{
    public function index(Request $request, Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [Partner::class, $organization]);

        $partners = $organization->partners()
            ->when($request->filled('search'), fn ($q) => $q->where('name', 'like', '%'.$request->string('search').'%'))
            ->orderBy('name')
            ->paginate($this->perPage($request));

        return PartnerResource::collection($partners);
    }

    public function store(PartnerRequest $request, Organization $organization): JsonResponse
    {
        $this->authorize('create', [Partner::class, $organization]);

        $partner = $organization->partners()->create($request->validated());

        return (new PartnerResource($partner))->response()->setStatusCode(201);
    }

    public function show(Organization $organization, Partner $partner): JsonResponse
    {
        $this->authorize('view', [$partner, $organization]);

        return (new PartnerResource($partner))->response();
    }

    public function update(PartnerRequest $request, Organization $organization, Partner $partner): JsonResponse
    {
        $this->authorize('update', [$partner, $organization]);

        $partner->update($request->validated());

        return (new PartnerResource($partner->refresh()))->response();
    }

    /**
     * Exclusão lógica: parceiros antigos continuam referenciados por matrículas existentes.
     */
    public function destroy(Organization $organization, Partner $partner): Response
    {
        $this->authorize('delete', [$partner, $organization]);

        $partner->delete();

        return response()->noContent();
    }
}
