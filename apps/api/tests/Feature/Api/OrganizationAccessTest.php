<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\Instructor;
use App\Models\Partner;
use App\Models\Student;
use App\Models\User;

/**
 * Isolamento entre organizações: nada de um espaço é visível ou referenciável em outro.
 */
class OrganizationAccessTest extends ApiTestCase
{
    public function test_creating_cfc_makes_creator_owner(): void
    {
        $user = User::factory()->create();

        $this->actingAsUser($user)->postJson($this->prefix.'/organizations', [
            'name' => 'CFC Alfa',
            'type' => 'cfc',
        ])->assertCreated()
            ->assertJsonPath('data.type', 'cfc')
            ->assertJsonPath('data.role', 'owner');

        $this->assertDatabaseHas('organization_user', ['user_id' => $user->getKey(), 'role' => 'owner']);
    }

    public function test_independent_space_links_creators_profile_automatically(): void
    {
        $user = User::factory()->create(['name' => 'João Silva']);

        $response = $this->actingAsUser($user)->postJson($this->prefix.'/organizations', [
            'name' => 'João — Particular',
            'type' => 'independent',
        ])->assertCreated();

        $organizationId = $response->json('data.id');
        $instructor = $user->fresh()->instructor;

        $this->assertNotNull($instructor, 'O perfil de instrutor deveria ter sido criado.');
        $this->assertDatabaseHas('organization_instructor', [
            'organization_id' => $organizationId,
            'instructor_id' => $instructor->getKey(),
            'active' => true,
        ]);
    }

    public function test_user_can_own_only_one_independent_space(): void
    {
        $user = User::factory()->create();
        $this->organizationWithOwner('independent', $user);

        $this->actingAsUser($user)->postJson($this->prefix.'/organizations', [
            'name' => 'Segundo particular',
            'type' => 'independent',
        ])->assertUnprocessable()->assertJsonPath('error', 'independent_space_exists');
    }

    public function test_organization_outside_membership_returns_not_found(): void
    {
        $organization = $this->organizationWithOwner('cfc');
        $stranger = User::factory()->create();

        $this->actingAsUser($stranger)
            ->getJson($this->prefix."/organizations/{$organization->getKey()}")
            ->assertNotFound();

        $this->actingAsUser($stranger)
            ->getJson($this->prefix."/organizations/{$organization->getKey()}/students")
            ->assertNotFound();
    }

    public function test_organization_listing_shows_only_memberships(): void
    {
        $owner = User::factory()->create();
        $mine = $this->organizationWithOwner('cfc', $owner);
        $this->organizationWithOwner('cfc');

        $this->actingAsUser($owner)->getJson($this->prefix.'/organizations')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $mine->getKey());
    }

    public function test_student_of_another_organization_is_not_reachable_by_path(): void
    {
        $owner = User::factory()->create();
        $alfa = $this->organizationWithOwner('cfc', $owner);
        $beta = $this->organizationWithOwner('cfc');
        $studentBeta = Student::factory()->for($beta)->create();

        $this->actingAsUser($owner)
            ->getJson($this->prefix."/organizations/{$alfa->getKey()}/students/{$studentBeta->getKey()}")
            ->assertNotFound();
    }

    public function test_cfc_lists_only_its_own_students(): void
    {
        $owner = User::factory()->create();
        $alfa = $this->organizationWithOwner('cfc', $owner);
        $beta = $this->organizationWithOwner('cfc');

        Student::factory()->for($alfa)->create(['name' => 'Aluno Alfa']);
        Student::factory()->for($beta)->create(['name' => 'Aluno Beta']);

        $this->actingAsUser($owner)
            ->getJson($this->prefix."/organizations/{$alfa->getKey()}/students")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Aluno Alfa');
    }

    public function test_same_cpf_is_allowed_in_different_organizations_without_merging(): void
    {
        $owner = User::factory()->create();
        $alfa = $this->organizationWithOwner('cfc', $owner);
        $beta = $this->organizationWithOwner('cfc', $owner);

        $payload = ['name' => 'Maria', 'cpf' => '123.456.789-09'];

        $this->actingAsUser($owner)->postJson($this->prefix."/organizations/{$alfa->getKey()}/students", $payload)
            ->assertCreated()->assertJsonPath('data.cpf', '12345678909');
        $this->actingAsUser($owner)->postJson($this->prefix."/organizations/{$beta->getKey()}/students", $payload)
            ->assertCreated();

        $this->assertSame(2, Student::query()->where('cpf', '12345678909')->count());
    }

    public function test_enrollment_rejects_partner_from_another_organization(): void
    {
        $owner = User::factory()->create();
        $alfa = $this->organizationWithOwner('cfc', $owner);
        $beta = $this->organizationWithOwner('cfc');
        $student = Student::factory()->for($alfa)->create();
        $partnerBeta = Partner::factory()->for($beta)->create();

        $this->actingAsUser($owner)->postJson($this->prefix."/organizations/{$alfa->getKey()}/enrollments", [
            'student_id' => $student->getKey(),
            'partner_id' => $partnerBeta->getKey(),
            'category' => 'B',
        ])->assertUnprocessable()->assertJsonValidationErrors('partner_id');
    }

    public function test_enrollment_rejects_student_from_another_organization(): void
    {
        $owner = User::factory()->create();
        $alfa = $this->organizationWithOwner('cfc', $owner);
        $beta = $this->organizationWithOwner('cfc');
        $studentBeta = Student::factory()->for($beta)->create();

        $this->actingAsUser($owner)->postJson($this->prefix."/organizations/{$alfa->getKey()}/enrollments", [
            'student_id' => $studentBeta->getKey(),
            'category' => 'B',
        ])->assertUnprocessable()->assertJsonValidationErrors('student_id');
    }

    public function test_lesson_rejects_enrollment_from_another_organization(): void
    {
        $owner = User::factory()->create();
        $alfa = $this->organizationWithOwner('cfc', $owner);
        $beta = $this->organizationWithOwner('cfc');
        $instructor = $this->linkInstructor($alfa);
        $enrollmentBeta = $this->enrollmentFor($beta);
        [$start, $end] = $this->window();

        $this->actingAsUser($owner)->postJson($this->prefix."/organizations/{$alfa->getKey()}/lessons", [
            'enrollment_id' => $enrollmentBeta->getKey(),
            'instructor_id' => $instructor->getKey(),
            'starts_at' => $start,
            'ends_at' => $end,
        ])->assertUnprocessable()->assertJsonValidationErrors('enrollment_id');
    }

    public function test_lesson_rejects_instructor_not_linked_to_organization(): void
    {
        $owner = User::factory()->create();
        $alfa = $this->organizationWithOwner('cfc', $owner);
        $enrollment = $this->enrollmentFor($alfa);
        $unlinked = Instructor::factory()->create();
        [$start, $end] = $this->window();

        $this->actingAsUser($owner)->postJson($this->prefix."/organizations/{$alfa->getKey()}/lessons", [
            'enrollment_id' => $enrollment->getKey(),
            'instructor_id' => $unlinked->getKey(),
            'starts_at' => $start,
            'ends_at' => $end,
        ])->assertUnprocessable()->assertJsonValidationErrors('instructor_id');
    }

    public function test_owner_can_update_organization_but_not_its_type(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        $path = $this->prefix."/organizations/{$organization->getKey()}";

        $this->actingAsUser($owner)->patchJson($path, ['name' => 'CFC Alfa Renomeado'])
            ->assertOk()->assertJsonPath('data.name', 'CFC Alfa Renomeado');

        $this->actingAsUser($owner)->patchJson($path, ['type' => 'independent'])
            ->assertUnprocessable()->assertJsonValidationErrors('type');
    }

    public function test_staff_cannot_update_organization_settings(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        $staff = User::factory()->create();
        $this->addMember($organization, $staff, MembershipRole::Staff);

        $this->actingAsUser($staff)
            ->patchJson($this->prefix."/organizations/{$organization->getKey()}", ['name' => 'Tentativa'])
            ->assertForbidden();
    }
}
