<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\Instructor;
use App\Models\Invitation;
use App\Models\Organization;
use App\Models\User;
use App\Notifications\OrganizationInvitation;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;

class InvitationTest extends ApiTestCase
{
    /**
     * Cria um convite cujo token em texto é conhecido pelo teste (o banco guarda só o hash).
     *
     * @return array{0: Invitation, 1: string}
     */
    private function invitationWithKnownToken(Organization $organization, array $attributes = []): array
    {
        $token = bin2hex(random_bytes(32));
        $invitation = Invitation::factory()->create(array_merge([
            'organization_id' => $organization->getKey(),
            'email' => 'convidada@example.com',
            'role' => MembershipRole::Staff,
            'token_hash' => hash('sha256', $token),
            'invited_by_user_id' => $organization->members()->first()->getKey(),
        ], $attributes));

        return [$invitation, $token];
    }

    private function invitedUser(string $email = 'convidada@example.com'): User
    {
        return User::factory()->create(['email' => $email]);
    }

    public function test_owner_creates_invitation_and_token_is_only_sent_by_email(): void
    {
        Notification::fake();
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);

        $response = $this->actingAsUser($owner)
            ->postJson($this->prefix."/organizations/{$organization->getKey()}/invitations", [
                'email' => 'Nova.Pessoa@Example.com',
                'role' => 'staff',
            ])->assertCreated()
            ->assertJsonPath('data.email', 'nova.pessoa@example.com')
            ->assertJsonPath('data.status', 'pending');

        $this->assertArrayNotHasKey('token', $response->json('data'));
        $this->assertArrayNotHasKey('token_hash', $response->json('data'));

        Notification::assertSentOnDemand(OrganizationInvitation::class);

        $stored = Invitation::query()->firstOrFail();
        $this->assertSame(64, strlen($stored->token_hash));
    }

    public function test_invitation_listing_never_exposes_tokens(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        [$invitation, $token] = $this->invitationWithKnownToken($organization);

        $body = $this->actingAsUser($owner)
            ->getJson($this->prefix."/organizations/{$organization->getKey()}/invitations")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->getContent();

        $this->assertStringNotContainsString($token, $body);
        $this->assertStringNotContainsString($invitation->token_hash, $body);
    }

    public function test_valid_invitation_grants_access_to_verified_recipient(): void
    {
        $organization = $this->organizationWithOwner('cfc');
        [$invitation, $token] = $this->invitationWithKnownToken($organization);
        $recipient = $this->invitedUser();

        $this->actingAsUser($recipient)
            ->postJson($this->prefix.'/invitations/accept', ['token' => $token])
            ->assertOk()
            ->assertJsonPath('data.status', 'accepted');

        $this->assertDatabaseHas('organization_user', [
            'organization_id' => $organization->getKey(),
            'user_id' => $recipient->getKey(),
            'role' => 'staff',
        ]);
        $this->assertNotNull($invitation->fresh()->accepted_at);
    }

    public function test_expired_invitation_is_rejected(): void
    {
        $organization = $this->organizationWithOwner('cfc');
        [, $token] = $this->invitationWithKnownToken($organization, ['expires_at' => now()->subMinute()]);

        $this->actingAsUser($this->invitedUser())
            ->postJson($this->prefix.'/invitations/accept', ['token' => $token])
            ->assertStatus(410)
            ->assertJsonPath('error', 'invitation_expired');
    }

    public function test_reused_invitation_is_rejected(): void
    {
        $organization = $this->organizationWithOwner('cfc');
        [, $token] = $this->invitationWithKnownToken($organization);
        $recipient = $this->invitedUser();

        $this->actingAsUser($recipient)->postJson($this->prefix.'/invitations/accept', ['token' => $token])->assertOk();

        $this->flushGuards();
        $this->actingAsUser($recipient)
            ->postJson($this->prefix.'/invitations/accept', ['token' => $token])
            ->assertConflict()
            ->assertJsonPath('error', 'invitation_already_used');
    }

    public function test_invitation_accepted_by_wrong_recipient_is_rejected(): void
    {
        $organization = $this->organizationWithOwner('cfc');
        [, $token] = $this->invitationWithKnownToken($organization);
        $intruder = User::factory()->create(['email' => 'outra@example.com']);

        $this->actingAsUser($intruder)
            ->postJson($this->prefix.'/invitations/accept', ['token' => $token])
            ->assertForbidden()
            ->assertJsonPath('error', 'invitation_recipient_mismatch');

        $this->assertDatabaseMissing('organization_user', ['user_id' => $intruder->getKey()]);
    }

    public function test_invitation_requires_verified_recipient_email(): void
    {
        $organization = $this->organizationWithOwner('cfc');
        [, $token] = $this->invitationWithKnownToken($organization);
        $unverified = User::factory()->unverified()->create(['email' => 'convidada@example.com']);

        $this->actingAsUser($unverified)
            ->postJson($this->prefix.'/invitations/accept', ['token' => $token])
            ->assertForbidden()
            ->assertJsonPath('error', 'email_not_verified');
    }

    public function test_revoked_invitation_is_rejected(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        [$invitation, $token] = $this->invitationWithKnownToken($organization);

        $this->actingAsUser($owner)
            ->deleteJson($this->prefix."/organizations/{$organization->getKey()}/invitations/{$invitation->getKey()}")
            ->assertOk()
            ->assertJsonPath('data.status', 'revoked');

        $this->flushGuards();
        $this->actingAsUser($this->invitedUser())
            ->postJson($this->prefix.'/invitations/accept', ['token' => $token])
            ->assertStatus(410)
            ->assertJsonPath('error', 'invitation_revoked');
    }

    public function test_unknown_token_is_not_found(): void
    {
        $this->actingAsUser($this->invitedUser())
            ->postJson($this->prefix.'/invitations/accept', ['token' => Str::random(64)])
            ->assertNotFound();
    }

    public function test_accept_ignores_identity_sent_in_payload(): void
    {
        $organization = $this->organizationWithOwner('cfc');
        [, $token] = $this->invitationWithKnownToken($organization);
        $recipient = $this->invitedUser();

        // Mesmo com e-mail/CPF de outra pessoa no corpo, só o token e a conta autenticada valem.
        $this->actingAsUser($recipient)->postJson($this->prefix.'/invitations/accept', [
            'token' => $token,
            'email' => 'outra@example.com',
            'cpf' => '12345678909',
        ])->assertOk();

        $this->assertDatabaseHas('organization_user', ['user_id' => $recipient->getKey()]);
    }

    public function test_recipient_with_different_instructor_profile_gets_explicit_conflict(): void
    {
        $organization = $this->organizationWithOwner('cfc');
        $indicated = $this->linkInstructor($organization);
        [, $token] = $this->invitationWithKnownToken($organization, [
            'role' => MembershipRole::Instructor,
            'instructor_id' => $indicated->getKey(),
        ]);

        $recipient = $this->invitedUser();
        $ownProfile = Instructor::factory()->create(['user_id' => $recipient->getKey()]);

        $this->actingAsUser($recipient)
            ->postJson($this->prefix.'/invitations/accept', ['token' => $token])
            ->assertConflict()
            ->assertJsonPath('error', 'instructor_profile_conflict');

        // Sem merge silencioso: nada foi criado e o perfil indicado continua sem conta.
        $this->assertDatabaseMissing('organization_user', ['user_id' => $recipient->getKey()]);
        $this->assertNull($indicated->fresh()->user_id);
        $this->assertNotNull($ownProfile->fresh());
    }

    public function test_unlinked_instructor_profile_is_bound_to_accepting_account(): void
    {
        $organization = $this->organizationWithOwner('cfc');
        $indicated = $this->linkInstructor($organization);
        [, $token] = $this->invitationWithKnownToken($organization, [
            'role' => MembershipRole::Instructor,
            'instructor_id' => $indicated->getKey(),
        ]);
        $recipient = $this->invitedUser();

        $this->actingAsUser($recipient)
            ->postJson($this->prefix.'/invitations/accept', ['token' => $token])
            ->assertOk();

        $this->assertSame($recipient->getKey(), $indicated->fresh()->user_id);
        $this->assertDatabaseHas('organization_instructor', [
            'organization_id' => $organization->getKey(),
            'instructor_id' => $indicated->getKey(),
            'active' => true,
        ]);
    }

    public function test_instructor_profile_indicated_already_bound_to_another_account_is_rejected(): void
    {
        $organization = $this->organizationWithOwner('cfc');
        $someoneElse = User::factory()->create();
        $bound = $this->linkInstructor($organization, $someoneElse);
        [, $token] = $this->invitationWithKnownToken($organization, [
            'role' => MembershipRole::Instructor,
            'instructor_id' => $bound->getKey(),
        ]);

        $this->actingAsUser($this->invitedUser())
            ->postJson($this->prefix.'/invitations/accept', ['token' => $token])
            ->assertConflict()
            ->assertJsonPath('error', 'instructor_profile_unavailable');
    }

    public function test_admin_cannot_invite_owner_or_admin(): void
    {
        $organization = $this->organizationWithOwner('cfc');
        $admin = User::factory()->create();
        $this->addMember($organization, $admin, MembershipRole::Admin);

        foreach (['owner', 'admin'] as $role) {
            $this->actingAsUser($admin)
                ->postJson($this->prefix."/organizations/{$organization->getKey()}/invitations", [
                    'email' => "{$role}@example.com",
                    'role' => $role,
                ])->assertForbidden()->assertJsonPath('error', 'role_not_assignable_by_admin');
        }
    }

    public function test_instructor_profile_linked_to_account_cannot_be_invited(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        $bound = $this->linkInstructor($organization, User::factory()->create());

        $this->actingAsUser($owner)
            ->postJson($this->prefix."/organizations/{$organization->getKey()}/invitations", [
                'email' => 'x@example.com',
                'role' => 'instructor',
                'instructor_id' => $bound->getKey(),
            ])->assertUnprocessable()->assertJsonPath('error', 'instructor_profile_unavailable');
    }

    public function test_instructor_id_is_rejected_for_non_instructor_roles(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        $instructor = $this->linkInstructor($organization);

        $this->actingAsUser($owner)
            ->postJson($this->prefix."/organizations/{$organization->getKey()}/invitations", [
                'email' => 'x@example.com',
                'role' => 'staff',
                'instructor_id' => $instructor->getKey(),
            ])->assertUnprocessable()->assertJsonValidationErrors('instructor_id');
    }

    public function test_duplicate_pending_invitation_and_existing_member_are_rejected(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        $existing = User::factory()->create(['email' => 'membro@example.com']);
        $this->addMember($organization, $existing, MembershipRole::Staff);
        $this->invitationWithKnownToken($organization, ['email' => 'pendente@example.com']);

        $path = $this->prefix."/organizations/{$organization->getKey()}/invitations";

        $this->actingAsUser($owner)->postJson($path, ['email' => 'pendente@example.com', 'role' => 'staff'])
            ->assertConflict()->assertJsonPath('error', 'invitation_already_pending');

        $this->actingAsUser($owner)->postJson($path, ['email' => 'membro@example.com', 'role' => 'staff'])
            ->assertConflict()->assertJsonPath('error', 'already_member');
    }

    public function test_invitations_are_scoped_to_their_organization(): void
    {
        $owner = User::factory()->create();
        $mine = $this->organizationWithOwner('cfc', $owner);
        $other = $this->organizationWithOwner('cfc');
        [$foreign] = $this->invitationWithKnownToken($other);

        $this->actingAsUser($owner)
            ->deleteJson($this->prefix."/organizations/{$mine->getKey()}/invitations/{$foreign->getKey()}")
            ->assertNotFound();
    }

    private function flushGuards(): void
    {
        $this->app['auth']->forgetGuards();
    }
}
