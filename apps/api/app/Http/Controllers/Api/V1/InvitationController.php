<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Invitations\CreateInvitation;
use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Invitations\StoreInvitationRequest;
use App\Http\Resources\InvitationResource;
use App\Models\Invitation;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class InvitationController extends Controller
{
    /**
     * Metadados apenas. Tokens nunca são listados.
     */
    public function index(Request $request, Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [Invitation::class, $organization]);

        $invitations = $organization->invitations()
            ->latest('id')
            ->paginate($this->perPage($request));

        return InvitationResource::collection($invitations);
    }

    public function store(
        StoreInvitationRequest $request,
        Organization $organization,
        CreateInvitation $createInvitation,
    ): JsonResponse {
        $this->authorize('create', [Invitation::class, $organization]);

        $invitation = $createInvitation($organization, $request->user(), $request->validated());

        return (new InvitationResource($invitation))->response()->setStatusCode(201);
    }

    public function destroy(Organization $organization, Invitation $invitation): JsonResponse
    {
        $this->authorize('revoke', [$invitation, $organization]);

        if ($invitation->accepted_at !== null) {
            throw new BusinessRuleException('Convites já aceitos não podem ser revogados.', 'invitation_already_used', 409);
        }

        if ($invitation->revoked_at === null) {
            $invitation->forceFill(['revoked_at' => now()])->save();
        }

        return (new InvitationResource($invitation->refresh()))->response();
    }
}
