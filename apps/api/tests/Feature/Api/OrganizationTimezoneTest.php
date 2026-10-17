<?php

namespace Tests\Feature\Api;

use App\Models\User;

class OrganizationTimezoneTest extends ApiTestCase
{
    public function test_new_organizations_default_to_sao_paulo_and_accept_a_valid_timezone(): void
    {
        $user = User::factory()->create();

        $this->actingAsUser($user)->postJson($this->prefix.'/organizations', ['name' => 'CFC Padrão', 'type' => 'cfc'])
            ->assertCreated()->assertJsonPath('data.timezone', 'America/Sao_Paulo');

        $this->actingAsUser($user)->postJson($this->prefix.'/organizations', ['name' => 'CFC Manaus', 'type' => 'cfc', 'timezone' => 'America/Manaus'])
            ->assertCreated()->assertJsonPath('data.timezone', 'America/Manaus');

        $this->actingAsUser($user)->postJson($this->prefix.'/organizations', ['name' => 'CFC Ruim', 'type' => 'cfc', 'timezone' => 'Marte/Olympus'])
            ->assertUnprocessable()->assertJsonValidationErrors('timezone');
    }

    public function test_day_filter_uses_the_organization_timezone(): void
    {
        $owner = User::factory()->create();
        $org = $this->organizationWithOwner('cfc', $owner);
        $instructor = $this->linkInstructor($org);
        $enrollment = $this->enrollmentFor($org);

        // 23:30 de 20/10 em São Paulo = 02:30 UTC de 21/10.
        $this->lessonFor($org, $instructor, $enrollment, '2026-10-21T02:30:00Z', '2026-10-21T03:20:00Z');
        $base = $this->prefix."/organizations/{$org->getKey()}/lessons";

        $this->actingAsUser($owner)->getJson("{$base}?from=2026-10-20&to=2026-10-20")
            ->assertOk()->assertJsonCount(1, 'data');

        $this->actingAsUser($owner)->getJson("{$base}?from=2026-10-21&to=2026-10-21")
            ->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_changing_the_timezone_changes_the_day_boundaries(): void
    {
        $owner = User::factory()->create();
        $org = $this->organizationWithOwner('cfc', $owner);
        $org->update(['timezone' => 'UTC']);
        $instructor = $this->linkInstructor($org);
        $this->lessonFor($org, $instructor, $this->enrollmentFor($org), '2026-10-21T02:30:00Z', '2026-10-21T03:20:00Z');

        $this->actingAsUser($owner)
            ->getJson($this->prefix."/organizations/{$org->getKey()}/lessons?from=2026-10-21&to=2026-10-21")
            ->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_personal_agenda_accepts_an_explicit_timezone(): void
    {
        $user = User::factory()->create();
        $org = $this->organizationWithOwner('cfc', $user);
        $instructor = $this->linkInstructor($org, $user);
        $this->lessonFor($org, $instructor, $this->enrollmentFor($org), '2026-10-21T02:30:00Z', '2026-10-21T03:20:00Z');

        $this->actingAsUser($user)->getJson($this->prefix.'/me/lessons?from=2026-10-20&to=2026-10-20')
            ->assertOk()->assertJsonCount(1, 'data'); // padrão: America/Sao_Paulo

        $this->actingAsUser($user)->getJson($this->prefix.'/me/lessons?from=2026-10-20&to=2026-10-20&timezone=UTC')
            ->assertOk()->assertJsonCount(0, 'data');
    }
}
