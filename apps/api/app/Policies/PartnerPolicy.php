<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\Partner;
use App\Models\User;

class PartnerPolicy extends OperationalPolicy
{
    public function viewAny(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function view(User $user, Partner $partner, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function create(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function update(User $user, Partner $partner, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function delete(User $user, Partner $partner, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }
}
