<?php

namespace App\Actions\Invitations;

use App\Enums\MembershipRole;
use App\Exceptions\BusinessRuleException;
use App\Models\Instructor;
use App\Models\Invitation;
use App\Models\Organization;
use App\Models\User;
use App\Notifications\OrganizationInvitation;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

/**
 * Cria um convite e envia o token por e-mail. O token em texto não é persistido
 * nem retornado pela API: apenas o hash SHA-256 fica no banco.
 */
class CreateInvitation
{
    /**
     * @param  array{email: string, role: string, instructor_id?: ?int}  $data
     */
    public function __invoke(Organization $organization, User $actor, array $data): Invitation
    {
        $email = Str::lower(trim($data['email']));
        $role = MembershipRole::from($data['role']);
        $actorRole = $organization->roleFor($actor);

        if ($actorRole === MembershipRole::Admin && ! in_array($role, MembershipRole::assignableByAdmin(), true)) {
            throw new BusinessRuleException(
                'Administradores só podem convidar para equipe e instrutores.',
                'role_not_assignable_by_admin',
                403,
            );
        }

        $instructorId = $role === MembershipRole::Instructor ? ($data['instructor_id'] ?? null) : null;

        $token = bin2hex(random_bytes(32));

        $invitation = DB::transaction(function () use ($organization, $actor, $email, $role, $instructorId, $token) {
            // Serializa convites concorrentes para o mesmo espaço.
            Organization::query()->whereKey($organization->getKey())->lockForUpdate()->first();

            $alreadyMember = $organization->members()
                ->whereRaw('LOWER(users.email) = ?', [$email])
                ->exists();

            if ($alreadyMember) {
                throw new BusinessRuleException('Esta pessoa já tem acesso ao espaço.', 'already_member', 409);
            }

            $pending = $organization->invitations()
                ->where('email', $email)
                ->whereNull('accepted_at')
                ->whereNull('revoked_at')
                ->where('expires_at', '>', now())
                ->exists();

            if ($pending) {
                throw new BusinessRuleException(
                    'Já existe um convite pendente para este e-mail. Revogue-o antes de convidar novamente.',
                    'invitation_already_pending',
                    409,
                );
            }

            if ($instructorId !== null) {
                $this->assertProfileCanBeInvited($instructorId);
            }

            $invitation = Invitation::create([
                'organization_id' => $organization->getKey(),
                'email' => $email,
                'role' => $role,
                'instructor_id' => $instructorId,
                'token_hash' => hash('sha256', $token),
                'invited_by_user_id' => $actor->getKey(),
                'expires_at' => Carbon::now()->addDays((int) config('autoescola.invitation_ttl_days')),
            ]);

            app(\App\Services\Audit::class)->record($organization->getKey(), 'access.invited',
                "Convite enviado a {$email} como {$role->value}.", [
                    'actor_id' => $actor->getKey(),
                    'subject' => $invitation,
                ]);

            return $invitation;
        });

        // Fora da transação: o e-mail não deve ser reenviado por rollback. Não é enfileirado,
        // para que o token não fique gravado na tabela de jobs.
        Notification::route('mail', $email)->notifyNow(
            new OrganizationInvitation($organization->name, $role, $token),
        );

        return $invitation;
    }

    /**
     * Perfil indicado no convite precisa estar sem conta, para ser associado ao aceitar.
     */
    private function assertProfileCanBeInvited(int $instructorId): void
    {
        $instructor = Instructor::query()->whereKey($instructorId)->lockForUpdate()->first();

        if ($instructor === null || $instructor->user_id !== null) {
            throw new BusinessRuleException(
                'Este perfil de instrutor já está vinculado a uma conta.',
                'instructor_profile_unavailable',
                422,
            );
        }
    }
}
