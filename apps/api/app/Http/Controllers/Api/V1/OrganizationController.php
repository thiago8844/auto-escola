<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Organizations\CreateOrganization;
use App\Enums\MembershipRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Organizations\StoreOrganizationRequest;
use App\Http\Requests\Organizations\UpdateOrganizationRequest;
use App\Http\Resources\OrganizationResource;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class OrganizationController extends Controller
{
    /**
     * Espaços acessíveis ao usuário autenticado, com o papel em cada um.
     */
    public function index(Request $request): AnonymousResourceCollection
    {
        $organizations = $request->user()->organizations()
            ->orderBy('organizations.name')
            ->paginate($this->perPage($request));

        return OrganizationResource::collection($organizations);
    }

    public function store(StoreOrganizationRequest $request, CreateOrganization $createOrganization): JsonResponse
    {
        $organization = $createOrganization($request->user(), $request->validated());

        return (new OrganizationResource($organization))
            ->withRole(MembershipRole::Owner->value)
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Organization $organization): JsonResponse
    {
        $this->authorize('view', $organization);

        return (new OrganizationResource($organization))->response();
    }

    public function update(UpdateOrganizationRequest $request, Organization $organization): JsonResponse
    {
        $this->authorize('update', $organization);

        $data = $request->validated();

        if (array_key_exists('business_hours', $data)) {
            $data['business_hours'] = app(\App\Services\WorkingHours::class)->normalize($data['business_hours']);
        }

        $organization->update($data);

        return (new OrganizationResource($organization->refresh()))->response();
    }
}
