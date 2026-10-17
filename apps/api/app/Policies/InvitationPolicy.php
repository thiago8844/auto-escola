<?php

namespace App\Policies;

use App\Models\Invitation;
use App\Models\Organization;
use App\Models\User;

class InvitationPolicy
{
    public function viewAny(User $user, Organization $organization): bool
    {
        return $organization->roleFor($user)?->canManageMembers() ?? false;
    }

    public function create(User $user, Organization $organization): bool
    {
        return $organization->roleFor($user)?->canManageMembers() ?? false;
    }

    public function revoke(User $user, Invitation $invitation, Organization $organization): bool
    {
        return $organization->roleFor($user)?->canManageMembers() ?? false;
    }
}
