<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\QualificationProcess;
use App\Models\User;

/**
 * Processos e checklist contêm informações de saúde (resultado operacional) e dados oficiais:
 * somente a equipe de operação acessa. Instrutores veem apenas se a matrícula está liberada.
 */
class QualificationProcessPolicy extends OperationalPolicy
{
    public function viewAny(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function view(User $user, QualificationProcess $process, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function create(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function update(User $user, QualificationProcess $process, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }
}
