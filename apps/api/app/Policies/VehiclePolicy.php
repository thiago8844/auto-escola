<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\User;
use App\Models\Vehicle;

/**
 * Veículos. Qualquer membro consulta (instrutores precisam escolher/ver o veículo da aula);
 * só a equipe de operação cadastra e altera.
 */
class VehiclePolicy extends OperationalPolicy
{
    public function viewAny(User $user, Organization $organization): bool
    {
        return $this->isMember($user, $organization);
    }

    public function view(User $user, Vehicle $vehicle, Organization $organization): bool
    {
        return $this->isMember($user, $organization);
    }

    public function create(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function update(User $user, Vehicle $vehicle, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function delete(User $user, Vehicle $vehicle, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }
}
