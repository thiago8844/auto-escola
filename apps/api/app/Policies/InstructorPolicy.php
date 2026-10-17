<?php

namespace App\Policies;

use App\Models\Instructor;
use App\Models\Organization;
use App\Models\User;

/**
 * Instrutores vinculados a uma organização.
 *
 * Identidade global (nome, credencial, categorias) só é editável pela própria conta
 * do instrutor (rota /me) ou, quando não há conta vinculada, por quem opera o espaço.
 * O vínculo com o espaço (ativar/desativar) é independente da identidade.
 */
class InstructorPolicy extends OperationalPolicy
{
    public function viewAny(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function view(User $user, Instructor $instructor, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function create(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    /**
     * Administradores não alteram a identidade de um instrutor que já tem conta.
     */
    public function updateIdentity(User $user, Instructor $instructor, Organization $organization): bool
    {
        return $instructor->user_id === null && $this->canOperate($user, $organization);
    }

    public function toggleLink(User $user, Instructor $instructor, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }
}
