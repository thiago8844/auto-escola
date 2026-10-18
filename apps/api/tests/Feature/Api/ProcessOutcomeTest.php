<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\Enrollment;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\QualificationProcess;
use App\Models\Student;
use App\Models\User;

/**
 * Módulo 3 — desfecho do processo, emissão, encerramento e trilha de histórico.
 */
class ProcessOutcomeTest extends ApiTestCase
{
    private User $owner;

    private Organization $org;

    private Instructor $instructor;

    private QualificationProcess $process;

    private Student $student;

    private string $base;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->org = $this->organizationWithOwner('cfc', $this->owner);
        $this->instructor = $this->linkInstructor($this->org);
        $this->base = $this->prefix."/organizations/{$this->org->getKey()}";
        $this->student = Student::factory()->for($this->org)->create();

        $id = $this->actingAsUser($this->owner)->postJson("{$this->base}/qualification-processes", [
            'student_id' => $this->student->getKey(), 'type' => 'first_license', 'uf' => 'MG', 'target_categories' => ['A', 'B'],
        ])->assertCreated()->json('data.id');
        $this->process = QualificationProcess::findOrFail($id);
        $this->releasePractice($this->process, $this->owner);
    }

    private function p(string $suffix = ''): string
    {
        return "{$this->base}/qualification-processes/{$this->process->getKey()}{$suffix}";
    }

    private function approve(string $category, int $day = 10): void
    {
        [$start] = $this->window($day, 9, 60);
        $id = $this->actingAsUser($this->owner)->postJson("{$this->base}/exams", [
            'qualification_process_id' => $this->process->getKey(), 'category' => $category, 'scheduled_at' => $start,
        ])->assertCreated()->json('data.id');
        $this->actingAsUser($this->owner)->postJson("{$this->base}/exams/{$id}/result", ['status' => 'approved'])->assertOk();
    }

    private function outcome(): array
    {
        return $this->actingAsUser($this->owner)->getJson($this->p())->assertOk()->json('data.outcome');
    }

    public function test_approved_without_issuance_is_tracked_separately_from_the_result(): void
    {
        $this->approve('A');
        $this->approve('B', 12);

        $outcome = $this->outcome();
        $this->assertTrue($outcome['issuance']['awaiting']);
        $this->assertSame('issuance_pending', $outcome['next_step']['code']);
        $this->assertSame('not_started', $outcome['issuance']['status']);
        $this->assertTrue($outcome['all_categories_resolved']);

        // Concluir exige a emissão registrada.
        $this->actingAsUser($this->owner)->postJson($this->p('/close'), ['kind' => 'completed'])
            ->assertStatus(422)->assertJsonPath('error', 'process_not_ready');
    }

    public function test_issuance_needs_an_approved_category_and_evidence_then_delivery(): void
    {
        $this->actingAsUser($this->owner)->postJson($this->p('/issuance'), ['status' => 'pending'])
            ->assertStatus(422)->assertJsonPath('error', 'no_approved_category');

        $this->approve('B');
        $this->actingAsUser($this->owner)->postJson($this->p('/issuance'), ['status' => 'pending'])->assertOk()
            ->assertJsonPath('data.outcome.issuance.status', 'pending')->assertJsonPath('data.status', 'preparing');

        $this->actingAsUser($this->owner)->postJson($this->p('/issuance'), ['status' => 'issued', 'kind' => 'ppd', 'issued_at' => now()->toDateString()])
            ->assertStatus(422)->assertJsonPath('error', 'issuance_evidence_required');

        $this->actingAsUser($this->owner)->postJson($this->p('/issuance'), [
            'status' => 'issued', 'kind' => 'ppd', 'issued_at' => now()->toDateString(), 'reference' => 'PPD-123', 'definitive_follow_up' => true,
        ])->assertOk()->assertJsonPath('data.outcome.issuance.status', 'issued')->assertJsonPath('data.outcome.next_step.code', 'exam_to_schedule');

        $this->actingAsUser($this->owner)->postJson($this->p('/issuance'), ['status' => 'delivered'])
            ->assertStatus(422)->assertJsonPath('error', 'delivery_date_required');
        $this->actingAsUser($this->owner)->postJson($this->p('/issuance'), ['status' => 'delivered', 'delivered_at' => now()->toDateString()])
            ->assertOk()->assertJsonPath('data.outcome.issuance.delivered_at', now()->toDateString());

        // Voltar etapa exige motivo.
        $this->actingAsUser($this->owner)->postJson($this->p('/issuance'), ['status' => 'issued'])->assertStatus(422)->assertJsonPath('error', 'reason_required');
    }

    public function test_ab_partial_does_not_close_the_process_and_renunciation_is_separate_from_confirmation(): void
    {
        $this->approve('A');

        $outcome = $this->outcome();
        $this->assertFalse($outcome['all_categories_resolved']);
        $this->assertSame('exam_to_schedule', $outcome['next_step']['code']);
        $this->assertSame('pending', collect($outcome['categories'])->firstWhere('category', 'B')['result']);

        $this->actingAsUser($this->owner)->postJson($this->p('/categories/B/renunciation'), ['reason' => 'Aluno quer só a A'])->assertOk();
        $b = collect($this->outcome()['categories'])->firstWhere('category', 'B');
        $this->assertSame('renounced', $b['result']);
        $this->assertNull($b['renunciation']['confirmed_at']);

        $this->actingAsUser($this->owner)->postJson($this->p('/categories/B/renunciation/confirm'), ['reference' => 'REN-9'])->assertOk();
        $this->assertNotNull(collect($this->outcome()['categories'])->firstWhere('category', 'B')['renunciation']['confirmed_at']);
        $this->assertTrue($this->outcome()['all_categories_resolved']);

        // Categoria renunciada não aceita novo exame; aprovada não pode ser renunciada.
        [$start] = $this->window(15, 9, 60);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/exams", ['qualification_process_id' => $this->process->getKey(), 'category' => 'B', 'scheduled_at' => $start])
            ->assertStatus(422)->assertJsonPath('error', 'category_renounced');
        $this->actingAsUser($this->owner)->postJson($this->p('/categories/A/renunciation'), ['reason' => 'Teste'])
            ->assertStatus(422)->assertJsonPath('error', 'category_already_approved');
    }

    public function test_closing_with_future_lessons_requires_explicit_choice_and_releases_reserved_credit(): void
    {
        $enrollment = Enrollment::create([
            'organization_id' => $this->org->getKey(), 'student_id' => $this->student->getKey(), 'category' => 'B',
            'qualification_process_id' => $this->process->getKey(),
        ]);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/enrollments/{$enrollment->getKey()}/packages", ['description' => 'Pacote', 'minutes' => 300])->assertCreated();
        [$start, $end] = $this->window(3, 9, 60);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons", [
            'enrollment_id' => $enrollment->getKey(), 'instructor_id' => $this->instructor->getKey(), 'starts_at' => $start, 'ends_at' => $end,
        ])->assertCreated();

        $check = $this->actingAsUser($this->owner)->getJson($this->p('/closure-check'))->assertOk()->json('data');
        $this->assertSame(1, $check['future_lessons']);
        $this->assertContains('unused_credits', collect($check['pending'])->pluck('code')->all());

        $this->actingAsUser($this->owner)->postJson($this->p('/close'), ['kind' => 'abandoned', 'reason' => 'Aluno desistiu'])
            ->assertStatus(422)->assertJsonPath('error', 'future_commitments');
        $this->actingAsUser($this->owner)->postJson($this->p('/close'), ['kind' => 'abandoned', 'reason' => 'Aluno desistiu', 'cancel_future' => true])
            ->assertStatus(422)->assertJsonPath('error', 'pending_items');
        $this->actingAsUser($this->owner)->postJson($this->p('/close'), ['kind' => 'abandoned', 'cancel_future' => true, 'acknowledge_pending' => true])
            ->assertStatus(422)->assertJsonPath('error', 'reason_required');

        $this->actingAsUser($this->owner)->postJson($this->p('/close'), [
            'kind' => 'abandoned', 'reason' => 'Aluno desistiu', 'cancel_future' => true, 'acknowledge_pending' => true,
        ])->assertOk()->assertJsonPath('data.status', 'closed')->assertJsonPath('data.outcome.closure.reason', 'Aluno desistiu');

        $balance = $this->actingAsUser($this->owner)->getJson("{$this->base}/enrollments/{$enrollment->getKey()}/balance")->json('data');
        $this->assertSame([0, 300], [$balance['reserved'], $balance['available']]);
        $this->assertDatabaseHas('lessons', ['enrollment_id' => $enrollment->getKey(), 'status' => 'cancelled']);

        // Processo encerrado não recebe novos exames.
        $this->actingAsUser($this->owner)->postJson("{$this->base}/exams", ['qualification_process_id' => $this->process->getKey(), 'category' => 'B', 'scheduled_at' => $start])
            ->assertStatus(422)->assertJsonPath('error', 'process_closed');
    }

    public function test_status_cannot_be_closed_through_plain_update_and_reopen_is_admin_only_with_reason(): void
    {
        $this->actingAsUser($this->owner)->patchJson($this->p(), ['status' => 'closed'])->assertStatus(422);

        $this->actingAsUser($this->owner)->postJson($this->p('/close'), ['kind' => 'other', 'reason' => 'Mudou de cidade', 'acknowledge_pending' => true])->assertOk();

        $staff = User::factory()->create();
        $this->addMember($this->org, $staff, MembershipRole::Staff);
        $this->actingAsUser($staff)->postJson($this->p('/reopen'), ['reason' => 'Voltou'])->assertForbidden();

        $this->actingAsUser($this->owner)->postJson($this->p('/reopen'), [])->assertStatus(422);
        $this->actingAsUser($this->owner)->postJson($this->p('/reopen'), ['reason' => 'Aluno voltou'])
            ->assertOk()->assertJsonPath('data.status', 'active')->assertJsonPath('data.outcome.closure.reason', null);
    }

    public function test_completed_process_with_all_categories_and_delivered_document(): void
    {
        $this->approve('A');
        $this->approve('B', 12);
        $this->actingAsUser($this->owner)->postJson($this->p('/issuance'), [
            'status' => 'delivered', 'kind' => 'cnh', 'issued_at' => now()->subDay()->toDateString(), 'delivered_at' => now()->toDateString(), 'reference' => 'CNH-1',
        ])->assertOk();

        $this->actingAsUser($this->owner)->postJson($this->p('/close'), ['kind' => 'completed'])
            ->assertOk()->assertJsonPath('data.status', 'completed')->assertJsonPath('data.outcome.next_step.code', 'closed');
    }

    public function test_timeline_reconstructs_the_journey_with_author_reason_and_changes(): void
    {
        $this->approve('B');
        $examId = $this->actingAsUser($this->owner)->getJson("{$this->base}/exams?category=B")->json('data.0.id');
        $this->actingAsUser($this->owner)->postJson("{$this->base}/exams/{$examId}/result-correction", ['status' => 'failed', 'reason' => 'Resultado lançado no aluno errado'])->assertOk();

        $events = $this->actingAsUser($this->owner)->getJson("{$this->base}/students/{$this->student->getKey()}/timeline")->assertOk()->json('data');
        $names = collect($events)->pluck('event')->all();
        $this->assertContains('process.created', $names);
        $this->assertContains('exam.scheduled', $names);
        $this->assertContains('exam.approved', $names);
        $this->assertContains('exam.result_corrected', $names);

        $corrected = collect($events)->firstWhere('event', 'exam.result_corrected');
        $this->assertSame($this->owner->name, $corrected['actor']['name']);
        $this->assertSame('Resultado lançado no aluno errado', $corrected['reason']);
        $this->assertEquals(['from' => 'approved', 'to' => 'failed'], $corrected['changes']['status']);

        $this->actingAsUser($this->owner)->getJson($this->p('/timeline?category=exam&per_page=2'))->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.per_page', 2);
        // O evento original permanece: nada foi sobrescrito.
        $this->assertContains('exam.approved', $names);
    }

    public function test_timeline_and_audit_are_role_filtered_and_stop_after_access_is_revoked(): void
    {
        $staff = User::factory()->create();
        $this->addMember($this->org, $staff, MembershipRole::Staff);
        $instructorUser = User::factory()->create();
        $this->addMember($this->org, $instructorUser, MembershipRole::Instructor);

        $timeline = "{$this->base}/students/{$this->student->getKey()}/timeline";
        $this->actingAsUser($staff)->getJson($timeline)->assertOk();
        $this->actingAsUser($instructorUser)->getJson($timeline)->assertForbidden();
        $this->actingAsUser($staff)->getJson("{$this->base}/audit-events")->assertForbidden();
        $this->actingAsUser($this->owner)->getJson("{$this->base}/audit-events")->assertOk();

        $this->actingAsUser($this->owner)->deleteJson("{$this->base}/members/{$staff->getKey()}")->assertNoContent();
        $this->org->forgetRoleCache();
        $this->actingAsUser($staff)->getJson($timeline)->assertNotFound();

        $this->actingAsUser($this->owner)->getJson("{$this->base}/audit-events?category=access")->assertOk()
            ->assertJsonPath('data.0.event', 'access.revoked');
    }

    public function test_critical_actions_are_audited_and_isolated_by_space(): void
    {
        $this->actingAsUser($this->owner)->patchJson($this->p(), ['status' => 'active'])->assertOk();
        $this->assertDatabaseHas('audit_events', ['event' => 'process.status', 'organization_id' => $this->org->getKey()]);

        $outsider = User::factory()->create();
        $other = $this->organizationWithOwner('cfc', $outsider);
        $this->actingAsUser($outsider)->getJson($this->prefix."/organizations/{$other->getKey()}/students/{$this->student->getKey()}/timeline")->assertNotFound();
        $this->actingAsUser($outsider)->getJson($this->prefix."/organizations/{$other->getKey()}/audit-events")->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_category_change_is_locked_after_exams_exist_on_the_enrollment(): void
    {
        $enrollment = Enrollment::create([
            'organization_id' => $this->org->getKey(), 'student_id' => $this->student->getKey(), 'category' => 'B',
            'qualification_process_id' => $this->process->getKey(),
        ]);
        [$start] = $this->window(10, 9, 60);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/exams", [
            'qualification_process_id' => $this->process->getKey(), 'enrollment_id' => $enrollment->getKey(), 'category' => 'B', 'scheduled_at' => $start,
        ])->assertCreated();

        $this->actingAsUser($this->owner)->patchJson("{$this->base}/enrollments/{$enrollment->getKey()}", ['category' => 'A'])
            ->assertStatus(422)->assertJsonPath('error', 'enrollment_category_locked');
        $this->actingAsUser($this->owner)->patchJson("{$this->base}/enrollments/{$enrollment->getKey()}", ['qualification_process_id' => null])
            ->assertStatus(422)->assertJsonPath('error', 'enrollment_process_locked');
    }
}
