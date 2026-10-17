<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\User;

/**
 * Matriz de permissões em nível de espaço. Ver docs/permissoes.md.
 */
class OrganizationPolicy
{
    public function view(User $user, Organization $organization): bool
    {
        return $organization->roleFor($user) !== null;
    }

    /**
     * Owner e admin atualizam dados cadastrais do espaço. O tipo não é alterável.
     */
    public function update(User $user, Organization $organization): bool
    {
        return $organization->roleFor($user)?->canManageMembers() ?? false;
    }

    /**
     * Gerencia membros e convites. Restrições por papel ficam nas Actions.
     */
    public function manageMembers(User $user, Organization $organization): bool
    {
        return $organization->roleFor($user)?->canManageMembers() ?? false;
    }
}
