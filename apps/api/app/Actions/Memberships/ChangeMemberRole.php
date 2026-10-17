<?php

namespace App\Actions\Memberships;

use App\Enums\MembershipRole;
use App\Exceptions\BusinessRuleException;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Altera o papel de um membro. Regras:
 * - Administrador só mexe em membros staff/instructor e só concede staff/instructor.
 * - O último proprietário não pode ser rebaixado.
 */
class ChangeMemberRole
{
    public function __invoke(Organization $organization, User $actor, User $target, MembershipRole $newRole): void
    {
        DB::transaction(function () use ($organization, $actor, $target, $newRole) {
            // Bloqueia o espaço para que alterações de papel concorrentes sejam serializadas.
            Organization::query()->whereKey($organization->getKey())->lockForUpdate()->first();

            $actorRole = $this->roleOf($organization, $actor);
            $currentRole = $this->roleOf($organization, $target);

            if ($actorRole === MembershipRole::Admin) {
                $this->assertAdminCanTouch($currentRole, $newRole);
            }

            if ($currentRole === MembershipRole::Owner && $newRole !== MembershipRole::Owner) {
                $this->assertAnotherOwnerExists($organization, $target);
            }

            $organization->members()->updateExistingPivot($target->getKey(), ['role' => $newRole->value]);
        });

        $organization->forgetRoleCache();
    }

    private function roleOf(Organization $organization, User $user): ?MembershipRole
    {
        $role = $organization->members()->whereKey($user->getKey())->first()?->pivot->role;

        return $role ? MembershipRole::from($role) : null;
    }

    private function assertAdminCanTouch(?MembershipRole $currentRole, MembershipRole $newRole): void
    {
        $assignable = MembershipRole::assignableByAdmin();

        if (! in_array($currentRole, $assignable, true) || ! in_array($newRole, $assignable, true)) {
            throw new BusinessRuleException(
                'Administradores só podem gerenciar acessos de equipe e instrutores.',
                'role_not_assignable_by_admin',
                403,
            );
        }
    }

    /**
     * Garante que, após a mudança, o espaço continue com ao menos um proprietário.
     */
    private function assertAnotherOwnerExists(Organization $organization, User $target): void
    {
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
}
