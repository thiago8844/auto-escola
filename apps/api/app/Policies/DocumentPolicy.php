<?php

namespace App\Policies;

use App\Models\Document;
use App\Models\Organization;
use App\Models\User;

/**
 * Documentos podem conter dados pessoais e de saúde: acesso restrito à equipe de operação,
 * inclusive o download.
 */
class DocumentPolicy extends OperationalPolicy
{
    public function viewAny(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function view(User $user, Document $document, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function create(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function update(User $user, Document $document, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }
}
