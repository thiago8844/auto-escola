<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\Enrollment;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\Student;
use App\Models\User;

/**
 * Instrutor vê apenas alunos e matrículas atribuídos a ele, sem dados sensíveis,
 * e a equipe não altera a identidade de instrutor que já tem conta.
 */
class InstructorPrivacyTest extends ApiTestCase
{
    private User $owner;

    private Organization $alfa;

    private User $instructorUser;

    private Instructor $me;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->alfa = $this->organizationWithOwner('cfc', $this->owner);

        $this->instructorUser = User::factory()->create();
        $this->addMember($this->alfa, $this->instructorUser, MembershipRole::Instructor);
        $this->me = $this->linkInstructor($this->alfa, $this->instructorUser);
    }

    public function test_instructor_sees_only_students_assigned_to_own_lessons(): void
    {
        $assigned = Student::factory()->for($this->alfa)->create(['name' => 'Atribuído']);
        $enrollment = Enrollment::create([
            'organization_id' => $this->alfa->getKey(),
            'student_id' => $assigned->getKey(),
            'category' => 'B',
        ]);
        [$start, $end] = $this->window(2, 9);
        $this->lessonFor($this->alfa, $this->me, $enrollment, $start, $end);

        Student::factory()->for($this->alfa)->create(['name' => 'Não atribuído']);

        $this->actingAsUser($this->instructorUser)
            ->getJson($this->prefix."/organizations/{$this->alfa->getKey()}/students")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Atribuído');
    }

    public function test_instructor_cannot_open_unassigned_student(): void
    {
        $unassigned = Student::factory()->for($this->alfa)->create();

        $this->actingAsUser($this->instructorUser)
            ->getJson($this->prefix."/organizations/{$this->alfa->getKey()}/students/{$unassigned->getKey()}")
            ->assertForbidden();
    }

    public function test_instructor_does_not_receive_student_cpf_email_or_birth_date(): void
    {
        $assigned = Student::factory()->for($this->alfa)->create(['cpf' => '12345678909']);
        $enrollment = Enrollment::create([
            'organization_id' => $this->alfa->getKey(),
            'student_id' => $assigned->getKey(),
            'category' => 'B',
        ]);
        [$start, $end] = $this->window(2, 9);
        $this->lessonFor($this->alfa, $this->me, $enrollment, $start, $end);

        $response = $this->actingAsUser($this->instructorUser)
            ->getJson($this->prefix."/organizations/{$this->alfa->getKey()}/students/{$assigned->getKey()}")
            ->assertOk()
            ->assertJsonPath('data.name', $assigned->name);

        $this->assertArrayNotHasKey('cpf', $response->json('data'));
        $this->assertArrayNotHasKey('email', $response->json('data'));
        $this->assertArrayNotHasKey('birth_date', $response->json('data'));

        // A equipe continua vendo os dados completos.
        $this->actingAsUser($this->owner)
            ->getJson($this->prefix."/organizations/{$this->alfa->getKey()}/students/{$assigned->getKey()}")
            ->assertOk()
            ->assertJsonPath('data.cpf', '12345678909');
    }

    public function test_instructor_cannot_manage_partners_or_students(): void
    {
        $path = $this->prefix."/organizations/{$this->alfa->getKey()}";

        $this->actingAsUser($this->instructorUser)->getJson("{$path}/partners")->assertForbidden();
        $this->actingAsUser($this->instructorUser)->postJson("{$path}/students", [
            'name' => 'Novo aluno',
        ])->assertForbidden();
    }

    public function test_instructor_cannot_list_colleagues_or_instructor_identities(): void
    {
        $this->actingAsUser($this->instructorUser)
            ->getJson($this->prefix."/organizations/{$this->alfa->getKey()}/instructors")
            ->assertForbidden()
            ->assertJsonPath('error', 'forbidden')
            ->assertJsonPath('message', 'Você não tem permissão para realizar esta ação.');
    }

    public function test_unauthenticated_api_request_returns_json_in_portuguese(): void
    {
        $this->getJson($this->prefix.'/organizations')
            ->assertUnauthorized()
            ->assertJsonPath('error', 'unauthenticated')
            ->assertJsonPath('message', 'Não autenticado.');
    }

    public function test_admin_cannot_change_identity_of_instructor_with_account(): void
    {
        $admin = User::factory()->create();
        $this->addMember($this->alfa, $admin, MembershipRole::Admin);

        $this->actingAsUser($admin)
            ->patchJson($this->prefix."/organizations/{$this->alfa->getKey()}/instructors/{$this->me->getKey()}", [
                'full_name' => 'Nome trocado pela admin',
            ])->assertForbidden()->assertJsonPath('error', 'instructor_identity_locked');

        $this->assertNotSame('Nome trocado pela admin', $this->me->fresh()->full_name);
    }

    public function test_instructor_updates_own_identity_in_personal_route(): void
    {
        $this->actingAsUser($this->instructorUser)
            ->patchJson($this->prefix.'/me/instructor', ['full_name' => 'Novo nome próprio'])
            ->assertOk()
            ->assertJsonPath('data.full_name', 'Novo nome próprio');
    }

    public function test_team_can_register_instructor_without_account_and_edit_identity(): void
    {
        $response = $this->actingAsUser($this->owner)
            ->postJson($this->prefix."/organizations/{$this->alfa->getKey()}/instructors", [
                'full_name' => 'Instrutor sem conta',
                'credential_number' => '98765',
                'categories' => ['A', 'B'],
            ])->assertCreated()
            ->assertJsonPath('data.has_account', false)
            ->assertJsonPath('data.active', true);

        $id = $response->json('data.id');

        $this->actingAsUser($this->owner)
            ->patchJson($this->prefix."/organizations/{$this->alfa->getKey()}/instructors/{$id}", [
                'categories' => ['B'],
            ])->assertOk()->assertJsonPath('data.categories', ['B']);
    }

    public function test_deactivating_link_keeps_identity_and_hides_nothing_globally(): void
    {
        $this->actingAsUser($this->owner)
            ->patchJson($this->prefix."/organizations/{$this->alfa->getKey()}/instructors/{$this->me->getKey()}/link", [
                'active' => false,
            ])->assertOk()->assertJsonPath('data.active', false);

        $this->assertNotNull($this->me->fresh());
        $this->assertSame($this->instructorUser->getKey(), $this->me->fresh()->user_id);
    }

    public function test_instructor_list_filters_by_link_status(): void
    {
        $this->actingAsUser($this->owner)
            ->getJson($this->prefix."/organizations/{$this->alfa->getKey()}/instructors?active=0")
            ->assertOk()->assertJsonCount(0, 'data');

        $this->actingAsUser($this->owner)
            ->getJson($this->prefix."/organizations/{$this->alfa->getKey()}/instructors?active=1")
            ->assertOk()->assertJsonCount(1, 'data');
    }
}
