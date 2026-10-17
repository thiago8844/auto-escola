<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Invitations\AcceptInvitation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Invitations\AcceptInvitationRequest;
use App\Http\Resources\InvitationResource;
use Illuminate\Http\JsonResponse;

class InvitationAcceptController extends Controller
{
    public function __invoke(AcceptInvitationRequest $request, AcceptInvitation $acceptInvitation): JsonResponse
    {
        $invitation = $acceptInvitation($request->user(), $request->validated('token'));

        return (new InvitationResource($invitation->load('organization')))
            ->additional(['message' => 'Convite aceito.'])
            ->response();
    }
}
