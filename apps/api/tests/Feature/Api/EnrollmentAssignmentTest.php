<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\AuditEvent;
use App\Models\User;

class EnrollmentAssignmentTest extends ApiTestCase
{
    public function test_secretaria_encaminha_sem_criar_aula_ou_alterar_saldo_e_instrutor_ve_somente_dados_operacionais(): void
    {
        $organization = $this->organizationWithOwner();
        $staff = User::factory()->create();
        $this->addMember($organization, $staff, MembershipRole::Staff);
        $user = User::factory()->create();
        $this->addMember($organization, $user, MembershipRole::Instructor);
        $instructor = $this->linkInstructor($organization, $user);
        $enrollment = $this->enrollmentFor($organization);
        $enrollment->update(['price_cents' => 120000, 'notes' => 'Contrato privado']);
        $base = $this->prefix."/organizations/{$organization->id}";

        $this->actingAsUser($user)->getJson("{$base}/enrollments/{$enrollment->id}")->assertForbidden();
        $this->actingAsUser($staff)->putJson("{$base}/enrollments/{$enrollment->id}/assignment", [
            'instructor_id' => $instructor->id, 'expected_instructor_id' => null,
        ])->assertOk()->assertJsonPath('data.assignment.instructor_id', $instructor->id);
        $this->assertDatabaseCount('lessons', 0);
        $this->assertDatabaseCount('enrollment_credit_entries', 0);
        $this->assertDatabaseHas('audit_events', ['event' => 'enrollment.assigned', 'actor_id' => $staff->id, 'enrollment_id' => $enrollment->id]);

        $this->actingAsUser($user)->getJson("{$base}/enrollments/{$enrollment->id}")->assertOk()
            ->assertJsonMissingPath('data.price_cents')->assertJsonMissingPath('data.notes')->assertJsonMissingPath('data.balance')
            ->assertJsonMissingPath('data.student.cpf');
        $this->getJson("{$base}/students/{$enrollment->student_id}")->assertOk()->assertJsonMissingPath('data.cpf');
        $this->getJson("{$base}/enrollments")->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("{$base}/documents?student_id={$enrollment->student_id}")->assertForbidden();
        $this->putJson("{$base}/enrollments/{$enrollment->id}/assignment", ['instructor_id' => null, 'expected_instructor_id' => $instructor->id])->assertForbidden();
        [$start, $end] = $this->window();
        $this->postJson("{$base}/lessons", [
            'enrollment_id' => $enrollment->id, 'instructor_id' => $instructor->id, 'starts_at' => $start, 'ends_at' => $end,
        ])->assertForbidden();
    }

    public function test_reencaminhamento_revoga_visao_sem_historico_e_recusa_alteracao_desatualizada(): void
    {
        $organization = $this->organizationWithOwner();
        $owner = $organization->members()->first();
        $user = User::factory()->create();
        $this->addMember($organization, $user, MembershipRole::Instructor);
        $first = $this->linkInstructor($organization, $user);
        $second = $this->linkInstructor($organization);
        $enrollment = $this->enrollmentFor($organization);
        $base = $this->prefix."/organizations/{$organization->id}";
        $url = "{$base}/enrollments/{$enrollment->id}/assignment";
        $this->actingAsUser($owner)->putJson($url, ['instructor_id' => $first->id, 'expected_instructor_id' => null])->assertOk();
        $this->putJson($url, ['instructor_id' => $second->id, 'expected_instructor_id' => null])->assertConflict()->assertJsonPath('error', 'stale_assignment');
        $this->putJson($url, ['instructor_id' => $second->id, 'expected_instructor_id' => $first->id])->assertOk();
        $this->assertSame(2, AuditEvent::where('event', 'enrollment.assigned')->count());
        $this->actingAsUser($user)->getJson("{$base}/enrollments/{$enrollment->id}")->assertForbidden();
        $this->getJson("{$base}/students/{$enrollment->student_id}")->assertForbidden();
        $this->getJson("{$base}/enrollments")->assertOk()->assertJsonCount(0, 'data');
        $this->actingAsUser($owner)->putJson($url, ['instructor_id' => null, 'expected_instructor_id' => $second->id])->assertOk()->assertJsonPath('data.assignment', null);
    }

    public function test_recusa_instrutor_externo_inativo_categoria_incompativel_e_matricula_de_outra_cfc(): void
    {
        $organization = $this->organizationWithOwner();
        $other = $this->organizationWithOwner();
        $external = $this->linkInstructor($other);
        $inactive = $this->linkInstructor($organization, active: false);
        $wrongCategory = $this->linkInstructor($organization);
        $wrongCategory->update(['categories' => ['A']]);
        $enrollment = $this->enrollmentFor($organization);
        $url = $this->prefix."/organizations/{$organization->id}/enrollments/{$enrollment->id}/assignment";
        $this->actingAsUser($organization->members()->first());
        foreach ([$external, $inactive, $wrongCategory] as $instructor) {
            $this->putJson($url, ['instructor_id' => $instructor->id, 'expected_instructor_id' => null])
                ->assertUnprocessable()->assertJsonValidationErrors('instructor_id');
        }
        $foreign = $this->enrollmentFor($other);
        $this->putJson($this->prefix."/organizations/{$organization->id}/enrollments/{$foreign->id}/assignment", ['instructor_id' => null, 'expected_instructor_id' => null])->assertNotFound();
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_historico_de_aulas_continua_visivel_apos_reencaminhamento(): void
    {
        $organization = $this->organizationWithOwner();
        $user = User::factory()->create();
        $this->addMember($organization, $user, MembershipRole::Instructor);
        $instructor = $this->linkInstructor($organization, $user);
        $enrollment = $this->enrollmentFor($organization);
        [$start, $end] = $this->window();
        $this->lessonFor($organization, $instructor, $enrollment, $start, $end);
        $this->actingAsUser($user)->getJson($this->prefix."/organizations/{$organization->id}/enrollments/{$enrollment->id}")->assertOk();
    }

    public function test_matricula_conjunta_aceita_responsavel_por_uma_categoria_e_encerrada_recusa_novo_encaminhamento(): void
    {
        $organization = $this->organizationWithOwner();
        $instructor = $this->linkInstructor($organization);
        $enrollment = $this->enrollmentFor($organization);
        $enrollment->update(['category' => 'AB']);
        $url = $this->prefix."/organizations/{$organization->id}/enrollments/{$enrollment->id}/assignment";
        $this->actingAsUser($organization->members()->first());
        $this->putJson($url, ['instructor_id' => $instructor->id, 'expected_instructor_id' => null])->assertOk();
        $this->putJson($url, ['instructor_id' => $instructor->id, 'expected_instructor_id' => $instructor->id])->assertOk();
        $this->assertSame(1, AuditEvent::where('event', 'enrollment.assigned')->count());
        $enrollment->update(['status' => 'closed']);
        $this->putJson($url, ['instructor_id' => null, 'expected_instructor_id' => $instructor->id])->assertOk();
        $this->putJson($url, ['instructor_id' => $instructor->id, 'expected_instructor_id' => null])->assertUnprocessable();
    }
}
