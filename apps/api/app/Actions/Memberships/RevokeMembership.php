<?php

namespace App\Actions\Memberships;

use App\Enums\MembershipRole;
use App\Exceptions\BusinessRuleException;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Revoga o acesso de um usuário ao espaço (remove a linha de organization_user).
 *
 * Registros operacionais (aulas, alunos) não são apagados: continuam na organização.
 * O usuário apenas deixa de vê-los na agenda pessoal e nas listagens do espaço.
 */
class RevokeMembership
{
    public function __invoke(Organization $organization, User $actor, User $target): void
    {
        DB::transaction(function () use ($organization, $actor, $target) {
            Organization::query()->whereKey($organization->getKey())->lockForUpdate()->first();

            $actorRole = $this->roleOf($organization, $actor);
            $currentRole = $this->roleOf($organization, $target);

            if ($actorRole === MembershipRole::Admin
                && ! in_array($currentRole, MembershipRole::assignableByAdmin(), true)) {
                throw new BusinessRuleException(
                    'Administradores só podem revogar acessos de equipe e instrutores.',
                    'role_not_assignable_by_admin',
                    403,
                );
            }

            if ($currentRole === MembershipRole::Owner) {
                $others = $organization->members()
                    ->wherePivot('role', MembershipRole::Owner->value)
                    ->where('users.id', '!=', $target->getKey())
                    ->count();

                if ($others === 0) {
                    throw new BusinessRuleException(
                        'A organização precisa manter ao menos um proprietário.',
                        'last_owner',
                        422,
                    );
                }
            }

            $organization->members()->detach($target->getKey());
        });

        $organization->forgetRoleCache();
    }

    private function roleOf(Organization $organization, User $user): ?MembershipRole
    {
        $role = $organization->members()->whereKey($user->getKey())->first()?->pivot->role;

        return $role ? MembershipRole::from($role) : null;
    }
}
