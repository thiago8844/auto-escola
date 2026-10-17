<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Memberships\ChangeMemberRole;
use App\Actions\Memberships\RevokeMembership;
use App\Enums\MembershipRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Memberships\UpdateMemberRoleRequest;
use App\Http\Resources\MemberResource;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Http\Response;

class OrganizationMemberController extends Controller
{
    public function index(Request $request, Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('manageMembers', $organization);

        $members = $organization->members()
            ->orderBy('users.name')
            ->paginate($this->perPage($request));

        return MemberResource::collection($members);
    }

    public function update(
        UpdateMemberRoleRequest $request,
        Organization $organization,
        User $member,
        ChangeMemberRole $changeRole,
    ): JsonResponse {
        $this->authorize('manageMembers', $organization);

        $changeRole(
            $organization,
            $request->user(),
            $member,
            MembershipRole::from($request->validated('role')),
        );

        $updated = $organization->members()->whereKey($member->getKey())->firstOrFail();

        return (new MemberResource($updated))->response();
    }

    public function destroy(
        Request $request,
        Organization $organization,
        User $member,
        RevokeMembership $revoke,
    ): Response {
        $this->authorize('manageMembers', $organization);

        $revoke($organization, $request->user(), $member);

        return response()->noContent();
    }
}
