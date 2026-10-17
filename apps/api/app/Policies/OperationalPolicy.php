<?php

namespace App\Policies;

use App\Models\Instructor;
use App\Models\Organization;
use App\Models\User;

/**
 * Regras compartilhadas para cadastros operacionais (parceiros, alunos, matrículas,
 * instrutores, aulas). Os métodos das policies específicas delegam para cá.
 */
abstract class OperationalPolicy
{
    protected function canOperate(User $user, Organization $organization): bool
    {
        return $organization->roleFor($user)?->canOperate() ?? false;
    }

    /**
     * Qualquer membro do espaço (inclusive instrutor). Quem filtra o que ele vê é o controller.
     */
    protected function isMember(User $user, Organization $organization): bool
    {
        return $organization->roleFor($user) !== null;
    }

    /**
     * Perfil de instrutor do usuário autenticado, se for membro com papel instructor.
     */
    protected function instructorOf(User $user, Organization $organization): ?Instructor
    {
        $role = $organization->roleFor($user);

        if ($role === null || $role->canOperate()) {
            return null;
        }

        return $user->instructor;
    }
}
