<?php

namespace App\Actions\Invitations;

use App\Actions\Instructors\CreateInstructorProfile;
use App\Actions\Instructors\LinkInstructorToOrganization;
use App\Enums\MembershipRole;
use App\Exceptions\BusinessRuleException;
use App\Models\Instructor;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Aceita um convite. Regras de segurança:
 * - O token é buscado pelo hash; nunca por nome, CPF ou e-mail enviados no payload.
 * - A conta aceitante precisa ter e-mail verificado e ser o destinatário do convite.
 * - Convite usado, revogado ou expirado não é aceito.
 * - Se a conta já tiver perfil de instrutor diferente do indicado, o conflito é
 *   informado explicitamente. Não há merge silencioso de perfis.
 */
class AcceptInvitation
{
    public function __construct(
        private readonly CreateInstructorProfile $createProfile,
        private readonly LinkInstructorToOrganization $link,
    ) {}

    public function __invoke(User $user, string $plainToken): Invitation
    {
        $invitation = Invitation::query()
            ->where('token_hash', hash('sha256', $plainToken))
            ->first();

        if ($invitation === null) {
            throw new BusinessRuleException('Convite inválido.', 'invitation_not_found', 404);
        }

        return DB::transaction(function () use ($user, $invitation) {
            // Trava o convite para impedir aceite duplo em requisições concorrentes.
            $invitation = Invitation::query()->whereKey($invitation->getKey())->lockForUpdate()->firstOrFail();

            $this->assertUsable($invitation);

            if (! $user->hasVerifiedEmail()) {
                throw new BusinessRuleException(
                    'Confirme seu e-mail antes de aceitar convites.',
                    'email_not_verified',
                    403,
                );
            }

            if (Str::lower($user->email) !== $invitation->email) {
                throw new BusinessRuleException(
                    'Este convite foi enviado para outro e-mail.',
                    'invitation_recipient_mismatch',
                    403,
                );
            }

            $organization = $invitation->organization()->firstOrFail();

            if ($organization->roleFor($user) !== null) {
                throw new BusinessRuleException('Você já tem acesso a este espaço.', 'already_member', 409);
            }

            $organization->members()->attach($user->getKey(), ['role' => $invitation->role->value]);

            if ($invitation->role === MembershipRole::Instructor) {
                $profile = $this->resolveProfile($user, $invitation);
                ($this->link)($organization, $profile);
            }

            $invitation->forceFill([
                'accepted_at' => now(),
                'accepted_by_user_id' => $user->getKey(),
            ])->save();

            app(\App\Services\Audit::class)->record($organization->getKey(), 'access.invitation_accepted',
                "Convite aceito por {$user->name} como {$invitation->role->value}.", [
                    'actor_id' => $user->getKey(),
                    'subject' => $invitation,
                ]);

            $organization->forgetRoleCache();

            return $invitation->refresh();
        });
    }

    private function assertUsable(Invitation $invitation): void
    {
        if ($invitation->accepted_at !== null) {
            throw new BusinessRuleException('Este convite já foi utilizado.', 'invitation_already_used', 409);
        }

        if ($invitation->revoked_at !== null) {
            throw new BusinessRuleException('Este convite foi revogado.', 'invitation_revoked', 410);
        }

        if ($invitation->isExpired()) {
            throw new BusinessRuleException('Este convite expirou.', 'invitation_expired', 410);
        }
    }

    /**
     * Define qual perfil profissional ficará associado à conta neste espaço.
     */
    private function resolveProfile(User $user, Invitation $invitation): Instructor
    {
        $ownProfile = Instructor::query()->where('user_id', $user->getKey())->lockForUpdate()->first();

        if ($invitation->instructor_id === null) {
            return $ownProfile ?? ($this->createProfile)($user, ['categories' => []]);
        }

        if ($ownProfile !== null && $ownProfile->getKey() !== $invitation->instructor_id) {
            throw new BusinessRuleException(
                'Sua conta já possui outro perfil de instrutor. Resolva o conflito com o espaço antes de aceitar.',
                'instructor_profile_conflict',
                409,
            );
        }

        $indicated = Instructor::query()->whereKey($invitation->instructor_id)->lockForUpdate()->firstOrFail();

        if ($indicated->user_id !== null && $indicated->user_id !== $user->getKey()) {
            throw new BusinessRuleException(
                'Este perfil de instrutor já está vinculado a outra conta.',
                'instructor_profile_unavailable',
                409,
            );
        }

        if ($indicated->user_id === null) {
            $indicated->forceFill(['user_id' => $user->getKey()])->save();
        }

        return $indicated;
    }
}
