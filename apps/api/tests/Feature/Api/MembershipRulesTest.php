<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\User;

class MembershipRulesTest extends ApiTestCase
{
    public function test_last_owner_cannot_be_demoted(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);

        $this->actingAsUser($owner)
            ->patchJson($this->prefix."/organizations/{$organization->getKey()}/members/{$owner->getKey()}", [
                'role' => 'admin',
            ])->assertUnprocessable()->assertJsonPath('error', 'last_owner');

        $this->assertDatabaseHas('organization_user', ['user_id' => $owner->getKey(), 'role' => 'owner']);
    }

    public function test_last_owner_cannot_be_removed(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);

        $this->actingAsUser($owner)
            ->deleteJson($this->prefix."/organizations/{$organization->getKey()}/members/{$owner->getKey()}")
            ->assertUnprocessable()->assertJsonPath('error', 'last_owner');

        $this->assertDatabaseHas('organization_user', ['user_id' => $owner->getKey()]);
    }

    public function test_owner_can_demote_owner_when_another_owner_remains(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        $second = User::factory()->create();
        $this->addMember($organization, $second, MembershipRole::Owner);

        $this->actingAsUser($owner)
            ->patchJson($this->prefix."/organizations/{$organization->getKey()}/members/{$second->getKey()}", [
                'role' => 'staff',
            ])->assertOk()->assertJsonPath('data.role', 'staff');
    }

    public function test_admin_cannot_promote_staff_to_admin_or_owner(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        $admin = User::factory()->create();
        $this->addMember($organization, $admin, MembershipRole::Admin);
        $staff = User::factory()->create();
        $this->addMember($organization, $staff, MembershipRole::Staff);

        foreach (['admin', 'owner'] as $role) {
            $this->actingAsUser($admin)
                ->patchJson($this->prefix."/organizations/{$organization->getKey()}/members/{$staff->getKey()}", [
                    'role' => $role,
                ])->assertForbidden()->assertJsonPath('error', 'role_not_assignable_by_admin');
        }

        $this->assertDatabaseHas('organization_user', ['user_id' => $staff->getKey(), 'role' => 'staff']);
    }

    public function test_admin_cannot_touch_owner_or_other_admin(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        $admin = User::factory()->create();
        $this->addMember($organization, $admin, MembershipRole::Admin);
        $otherAdmin = User::factory()->create();
        $this->addMember($organization, $otherAdmin, MembershipRole::Admin);

        $this->actingAsUser($admin)
            ->deleteJson($this->prefix."/organizations/{$organization->getKey()}/members/{$owner->getKey()}")
            ->assertForbidden();

        $this->actingAsUser($admin)
            ->deleteJson($this->prefix."/organizations/{$organization->getKey()}/members/{$otherAdmin->getKey()}")
            ->assertForbidden();
    }

    public function test_admin_can_manage_staff_and_instructor_access(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        $admin = User::factory()->create();
        $this->addMember($organization, $admin, MembershipRole::Admin);
        $instructorUser = User::factory()->create();
        $this->addMember($organization, $instructorUser, MembershipRole::Instructor);

        $this->actingAsUser($admin)
            ->patchJson($this->prefix."/organizations/{$organization->getKey()}/members/{$instructorUser->getKey()}", [
                'role' => 'staff',
            ])->assertOk()->assertJsonPath('data.role', 'staff');

        $this->actingAsUser($admin)
            ->deleteJson($this->prefix."/organizations/{$organization->getKey()}/members/{$instructorUser->getKey()}")
            ->assertNoContent();
    }

    public function test_staff_and_instructor_cannot_manage_members(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        $staff = User::factory()->create();
        $this->addMember($organization, $staff, MembershipRole::Staff);
        $instructor = User::factory()->create();
        $this->addMember($organization, $instructor, MembershipRole::Instructor);
        $path = $this->prefix."/organizations/{$organization->getKey()}/members";

        $this->actingAsUser($staff)->getJson($path)->assertForbidden();
        $this->actingAsUser($instructor)->getJson($path)->assertForbidden();
        $this->actingAsUser($instructor)->getJson($this->prefix."/organizations/{$organization->getKey()}/invitations")
            ->assertForbidden();
    }

    public function test_members_listing_is_paginated_and_does_not_expose_tokens(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);

        $this->actingAsUser($owner)
            ->getJson($this->prefix."/organizations/{$organization->getKey()}/members")
            ->assertOk()
            ->assertJsonPath('data.0.role', 'owner')
            ->assertJsonStructure(['data', 'links', 'meta'])
            ->assertJsonMissingPath('data.0.password');
    }
}
