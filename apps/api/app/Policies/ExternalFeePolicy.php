<?php

namespace App\Policies;

use App\Models\ExternalFee;
use App\Models\Organization;
use App\Models\User;

/**
 * Taxas externas envolvem valores e comprovantes: somente a equipe de operação.
 */
class ExternalFeePolicy extends OperationalPolicy
{
    public function viewAny(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function view(User $user, ExternalFee $fee, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function manage(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }
}
