<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\PracticalExam;
use App\Models\User;

/**
 * Exames: a equipe de operação gerencia. O instrutor responsável vê somente o resumo
 * operacional dos próprios exames (a listagem é filtrada no controller). Correção de
 * resultado: proprietário e administrador.
 */
class PracticalExamPolicy extends OperationalPolicy
{
    public function viewAny(User $user, Organization $organization): bool
    {
        return $this->isMember($user, $organization);
    }

    public function view(User $user, PracticalExam $exam, Organization $organization): bool
    {
        if ($this->canOperate($user, $organization)) {
            return true;
        }

        $instructor = $this->instructorOf($user, $organization);

        return $instructor !== null && $exam->instructor_id === $instructor->getKey();
    }

    public function manage(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function correct(User $user, PracticalExam $exam, Organization $organization): bool
    {
        return $organization->roleFor($user)?->canAudit() ?? false;
    }
}
