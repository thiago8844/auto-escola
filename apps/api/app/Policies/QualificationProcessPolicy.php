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

    /** Emissão, renúncia, encerramento e linha do tempo: equipe de operação. */
    public function outcome(User $user, QualificationProcess $process, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    /** Reabrir processo encerrado: proprietário e administrador. */
    public function reopen(User $user, QualificationProcess $process, Organization $organization): bool
    {
        return $organization->roleFor($user)?->canAudit() ?? false;
    }
}
