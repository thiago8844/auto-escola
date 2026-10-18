<?php

namespace App\Policies;

use App\Models\AvailabilityBlock;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\User;

/**
 * Bloqueios e manutenção.
 *
 * - Veículo e bloqueio do espaço para instrutor: equipe de operação.
 * - Indisponibilidade pessoal: somente o próprio instrutor (qualquer papel com conta), pois vale em todos os espaços dele.
 * - Manutenção traz custos e documentos: equipe de operação.
 */
class AvailabilityBlockPolicy extends OperationalPolicy
{
    public function viewAny(User $user, Organization $organization): bool
    {
        return $this->isMember($user, $organization);
    }

    public function operate(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    /**
     * @param  array<string, mixed>  $data  dados validados do bloqueio
     */
    public function create(User $user, Organization $organization, array $data): bool
    {
        if (($data['resource_type'] ?? null) === 'instructor' && ($data['scope'] ?? 'organization') === 'personal') {
            return $this->isInstructorUser($user, (int) $data['instructor_id']);
        }

        return $this->canOperate($user, $organization);
    }

    public function change(User $user, AvailabilityBlock $block, Organization $organization): bool
    {
        if ($block->resource_type === 'instructor' && $block->isPersonal()) {
            return $this->isInstructorUser($user, (int) $block->instructor_id);
        }

        return $this->canOperate($user, $organization);
    }


    private function isInstructorUser(User $user, int $instructorId): bool
    {
        return Instructor::query()->whereKey($instructorId)->where('user_id', $user->getKey())->exists();
    }
}
