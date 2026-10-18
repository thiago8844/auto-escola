<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\Document;
use App\Models\Enrollment;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\Partner;
use Carbon\CarbonImmutable;
use App\Models\PracticalExam;
use App\Models\QualificationProcess;
use App\Models\Student;
use App\Models\User;

/**
 * Módulo 2 — exames práticos e taxas externas.
 */
class PracticalExamTest extends ApiTestCase
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

        // Pedido AB: um processo, duas categorias.
        $id = $this->actingAsUser($this->owner)->postJson("{$this->base}/qualification-processes", [
            'student_id' => $this->student->getKey(), 'type' => 'first_license', 'uf' => 'MG',
            'target_categories' => ['A', 'B'],
        ])->assertCreated()->json('data.id');
        $this->process = QualificationProcess::findOrFail($id);
    }

    private function exam(string $category = 'B', int $daysAhead = 10, int $hour = 9, array $extra = [])
    {
        [$start] = $this->window($daysAhead, $hour, 60);

        return $this->actingAsUser($this->owner)->postJson("{$this->base}/exams", $extra + [
            'qualification_process_id' => $this->process->getKey(),
            'category' => $category,
            'scheduled_at' => $start,
            'location' => 'Pátio do Detran',
        ]);
    }

    private function recordResult(int $id, string $status, ?string $reason = null)
    {
        return $this->actingAsUser($this->owner)->postJson("{$this->base}/exams/{$id}/result", ['status' => $status, 'reason' => $reason]);
    }

    public function test_aceite_failed_in_b_keeps_history_extra_lessons_new_attempt_approved_without_touching_a(): void
    {
        $a = $this->exam('A', 10)->assertCreated()->json('data.id');
        $b1 = $this->exam('B', 10, 11)->assertCreated()->assertJsonPath('data.attempt_number', 1)->json('data.id');
        $this->recordResult($a, 'approved')->assertOk();
        $this->recordResult($b1, 'failed')->assertOk();

        // Aula adicional contratada entre as tentativas.
        $enrollment = Enrollment::create(['organization_id' => $this->org->getKey(), 'student_id' => $this->student->getKey(), 'category' => 'B', 'qualification_process_id' => $this->process->getKey()]);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/enrollments/{$enrollment->getKey()}/packages", ['description' => 'Reforço', 'minutes' => 120])->assertCreated();

        $b2 = $this->exam('B', 20)->assertCreated()->assertJsonPath('data.attempt_number', 2)->json('data.id');
        $this->recordResult($b2, 'approved')->assertOk();

        $this->assertDatabaseHas('practical_exams', ['id' => $a, 'status' => 'approved', 'attempt_number' => 1]);
        $this->assertDatabaseHas('practical_exams', ['id' => $b1, 'status' => 'failed']);
        $categories = collect($this->actingAsUser($this->owner)->getJson("{$this->base}/qualification-processes/{$this->process->getKey()}")->json('data.outcome.categories'));
        $this->assertSame('approved', $categories->firstWhere('category', 'A')['result']);
        $this->assertSame(2, $categories->firstWhere('category', 'B')['attempts']);

        // Taxas nunca viram receita: nenhum movimento financeiro existe e o efeito em caixa é "none".
        $feeId = $this->actingAsUser($this->owner)->postJson("{$this->base}/external-fees", [
            'qualification_process_id' => $this->process->getKey(), 'kind' => 'Taxa de exame prático', 'amount_cents' => 12000,
        ])->assertCreated()->assertJsonPath('data.cash_effect', 'none')->json('data.id');
        $this->assertNotNull($feeId);
    }

    public function test_attempt_numbers_are_unique_and_one_active_attempt_per_category(): void
    {
        $first = $this->exam('B')->assertCreated()->json('data.id');

        $this->exam('B', 12)->assertStatus(422)->assertJsonPath('error', 'exam_already_scheduled');

        $this->recordResult($first, 'cancelled', 'Aluno sem condições')->assertOk();
        $this->exam('B', 12)->assertCreated()->assertJsonPath('data.attempt_number', 2);

        $this->assertSame(2, PracticalExam::query()->where('category', 'B')->count());
        $this->assertDatabaseHas('practical_exams', ['id' => $first, 'status' => 'cancelled']);
    }

    public function test_cannot_schedule_after_approval_or_for_foreign_category(): void
    {
        $id = $this->exam('B')->assertCreated()->json('data.id');
        $this->recordResult($id, 'approved')->assertOk();

        $this->exam('B', 15)->assertStatus(422)->assertJsonPath('error', 'category_already_approved');
        $this->exam('C', 15)->assertStatus(422);
    }

    public function test_reschedule_takes_only_the_new_date_with_a_reason_and_keeps_the_previous_one(): void
    {
        $id = $this->exam('B')->assertCreated()->json('data.id');
        [$new] = $this->window(14, 14, 60);

        $this->actingAsUser($this->owner)->postJson("{$this->base}/exams/{$id}/reschedule", [
            'scheduled_at' => $new, 'reason' => 'Chuva',
        ])->assertOk()
            ->assertJsonPath('data.reschedule_count', 1)
            ->assertJsonPath('data.location', 'Pátio do Detran')
            ->assertJsonPath('data.schedule_history.0.reason', 'Chuva')
            ->assertJsonPath('data.attempt_number', 1);

        $this->actingAsUser($this->owner)->postJson("{$this->base}/exams/{$id}/reschedule", ['scheduled_at' => $new])->assertStatus(422);
    }

    public function test_edit_corrects_the_date_and_other_data_without_touching_the_reschedule_history(): void
    {
        $id = $this->exam('B')->assertCreated()->json('data.id');
        [$right] = $this->window(12, 10, 60);

        $this->actingAsUser($this->owner)->patchJson("{$this->base}/exams/{$id}", ['scheduled_at' => $right, 'location' => 'Detran Centro', 'notes' => 'Levar documento'])
            ->assertOk()
            ->assertJsonPath('data.location', 'Detran Centro')
            ->assertJsonPath('data.reschedule_count', 0)
            ->assertJsonPath('data.schedule_history', []);

        $this->assertSame(
            CarbonImmutable::parse($right)->utc()->toIso8601String(),
            CarbonImmutable::parse($this->actingAsUser($this->owner)->getJson("{$this->base}/exams/{$id}")->json('data.scheduled_at'))->utc()->toIso8601String(),
        );

        $this->recordResult($id, 'failed', 'Reprovado')->assertOk();
        $this->actingAsUser($this->owner)->patchJson("{$this->base}/exams/{$id}", ['notes' => 'Obs. depois do resultado'])->assertOk();
        $this->actingAsUser($this->owner)->patchJson("{$this->base}/exams/{$id}", ['scheduled_at' => $right])->assertStatus(422);
    }

    public function test_exam_carries_the_driving_school_and_registration_data_from_the_student(): void
    {
        $partner = Partner::create(['organization_id' => $this->org->getKey(), 'name' => 'CFC Parceiro']);
        $this->student->forceFill(['identity_number' => 'MG-12.345.678', 'identity_issuer' => 'SSP/MG', 'partner_id' => $partner->getKey()])->save();

        $exam = $this->exam('B')->assertCreated()
            ->assertJsonPath('data.driving_school.kind', 'partner')
            ->assertJsonPath('data.driving_school.name', 'CFC Parceiro')
            ->assertJsonPath('data.registration.identity_number', 'MG-12.345.678')
            ->assertJsonPath('data.registration.identity_issuer', 'SSP/MG')
            ->assertJsonPath('data.registration.category', 'B')
            ->assertJsonMissingPath('data.protocol')
            ->assertJsonMissingPath('data.duration_minutes')
            ->json('data.id');

        // Autoescola própria (espaço) escolhida explicitamente, em vez da do aluno.
        $this->actingAsUser($this->owner)->patchJson("{$this->base}/exams/{$exam}", ['partner_id' => null])
            ->assertOk()->assertJsonPath('data.driving_school.kind', 'space');
    }

    public function test_pending_flags_missing_student_registration_data(): void
    {
        $this->student->forceFill(['identity_number' => null, 'identity_issuer' => null])->save();
        $id = $this->exam('B')->assertCreated()->json('data.id');

        $codes = collect($this->actingAsUser($this->owner)->getJson("{$this->base}/exams/{$id}")->json('data.pending'))->pluck('code');
        $this->assertTrue($codes->contains('student_data'));
    }

    public function test_independent_space_requires_the_driving_school_on_the_exam(): void
    {
        $this->org->forceFill(['type' => \App\Enums\OrganizationType::Independent])->save();
        $this->student->forceFill(['partner_id' => null])->save();

        $this->exam('B')->assertStatus(422)->assertJsonPath('error', 'driving_school_required');

        $partner = Partner::create(['organization_id' => $this->org->getKey(), 'name' => 'CFC Parceiro']);
        $this->exam('B', 10, 9, ['partner_id' => $partner->getKey()])->assertCreated()->assertJsonPath('data.driving_school.id', $partner->getKey());
    }

    public function test_absence_is_not_a_failure_and_results_are_final_until_corrected(): void
    {
        $id = $this->exam('B')->assertCreated()->json('data.id');

        $this->recordResult($id, 'absent')->assertStatus(422)->assertJsonPath('error', 'reason_required');
        $this->recordResult($id, 'absent', 'Não compareceu')->assertOk()->assertJsonPath('data.status', 'absent');
        $this->recordResult($id, 'failed')->assertStatus(422)->assertJsonPath('error', 'invalid_status_transition');

        $outcome = $this->actingAsUser($this->owner)->getJson("{$this->base}/qualification-processes/{$this->process->getKey()}")->json('data.outcome');
        $this->assertSame('absent', collect($outcome['categories'])->firstWhere('category', 'B')['result']);
        $this->assertSame('practice_release', $outcome['next_step']['code']);

        $this->releasePractice($this->process, $this->owner);
        $outcome = $this->actingAsUser($this->owner)->getJson("{$this->base}/qualification-processes/{$this->process->getKey()}")->json('data.outcome');
        $this->assertSame('exam_retry', $outcome['next_step']['code']);
    }

    public function test_result_correction_requires_admin_and_reason_and_is_audited(): void
    {
        $id = $this->exam('B')->assertCreated()->json('data.id');
        $this->recordResult($id, 'failed')->assertOk();
        $path = "{$this->base}/exams/{$id}/result-correction";

        $this->actingAsUser($this->owner)->postJson($path, ['status' => 'approved'])->assertStatus(422);
        $this->actingAsUser($this->owner)->postJson($path, ['status' => 'approved', 'reason' => 'Lançado errado'])
            ->assertOk()->assertJsonPath('data.status', 'approved');

        $this->assertDatabaseHas('audit_events', ['event' => 'exam.result_corrected', 'reason' => 'Lançado errado']);

        $staff = User::factory()->create();
        $this->addMember($this->org, $staff, MembershipRole::Staff);
        $this->actingAsUser($staff)->postJson($path, ['status' => 'failed', 'reason' => 'Teste'])->assertForbidden();
    }

    public function test_instructor_window_conflicts_with_lessons_and_exams_across_spaces(): void
    {
        $this->exam('B', 10, 9, ['instructor_id' => $this->instructor->getKey()])->assertCreated();

        // Outra aula no mesmo horário, no mesmo espaço.
        $enrollment = $this->enrollmentFor($this->org);
        [$start, $end] = $this->window(10, 9, 30);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons", [
            'enrollment_id' => $enrollment->getKey(), 'instructor_id' => $this->instructor->getKey(), 'starts_at' => $start, 'ends_at' => $end,
        ])->assertStatus(409)->assertJsonPath('error', 'instructor_unavailable');

        // Outro espaço com o mesmo instrutor: indisponível, sem revelar o espaço.
        $otherOwner = User::factory()->create();
        $other = $this->organizationWithOwner('cfc', $otherOwner);
        $other->instructors()->attach($this->instructor->getKey(), ['active' => true]);
        $otherEnrollment = $this->enrollmentFor($other);
        $response = $this->actingAsUser($otherOwner)->postJson($this->prefix."/organizations/{$other->getKey()}/lessons", [
            'enrollment_id' => $otherEnrollment->getKey(), 'instructor_id' => $this->instructor->getKey(), 'starts_at' => $start, 'ends_at' => $end,
        ])->assertStatus(409);
        $this->assertStringNotContainsString($this->org->name, $response->getContent());

        // E exame sobre uma aula já agendada.
        [$s2] = $this->window(11, 9, 60);
        $this->lessonFor($this->org, $this->instructor, $enrollment, $s2, \Carbon\CarbonImmutable::parse($s2)->addMinutes(60)->toIso8601String());
        $this->exam('A', 11, 9, ['instructor_id' => $this->instructor->getKey()])->assertStatus(409);
    }

    public function test_exam_pending_items_follow_checklist_and_open_fees_without_inventing_rules(): void
    {
        $id = $this->exam('B')->assertCreated()->json('data.id');

        $codes = collect($this->actingAsUser($this->owner)->getJson("{$this->base}/exams/{$id}")->json('data.pending'))->pluck('code');
        $this->assertContains('checklist', $codes);

        $this->actingAsUser($this->owner)->postJson("{$this->base}/external-fees", [
            'qualification_process_id' => $this->process->getKey(), 'kind' => 'Taxa', 'exam_ids' => [$id],
        ])->assertCreated();

        $codes = collect($this->actingAsUser($this->owner)->getJson("{$this->base}/exams/{$id}")->json('data.pending'))->pluck('code');
        $this->assertContains('fees_open', $codes);

        $this->releasePractice($this->process, $this->owner);
        $codes = collect($this->actingAsUser($this->owner)->getJson("{$this->base}/exams/{$id}")->json('data.pending'))->pluck('code');
        $this->assertNotContains('checklist', $codes);
    }

    public function test_fee_payment_confirmation_accepts_an_optional_receipt_and_a_receipt_alone_confirms_nothing(): void
    {
        $fee = $this->actingAsUser($this->owner)->postJson("{$this->base}/external-fees", [
            'qualification_process_id' => $this->process->getKey(), 'kind' => 'Taxa de exame', 'voucher_number' => 'G-1', 'amount_cents' => 9000,
        ])->assertCreated()->assertJsonPath('data.status', 'unknown')->json('data.id');

        $doc = Document::create([
            'organization_id' => $this->org->getKey(), 'type' => 'payment_proof', 'student_id' => $this->student->getKey(),
            'qualification_process_id' => $this->process->getKey(), 'storage_path' => 'x', 'original_name' => 'c.pdf', 'mime_type' => 'application/pdf', 'size' => 10,
        ]);
        $this->actingAsUser($this->owner)->patchJson("{$this->base}/external-fees/{$fee}", ['receipt_document_id' => $doc->getKey()])
            ->assertOk()->assertJsonPath('data.status', 'unknown')->assertJsonPath('data.confirmed_at', null);

        $status = "{$this->base}/external-fees/{$fee}/status";
        $this->actingAsUser($this->owner)->postJson($status, ['status' => 'payment_reported'])->assertOk()->assertJsonPath('data.is_open', true);
        $this->actingAsUser($this->owner)->postJson($status, ['status' => 'confirmed'])
            ->assertStatus(422)->assertJsonPath('error', 'paid_by_required');
        $this->actingAsUser($this->owner)->postJson($status, ['status' => 'confirmed', 'paid_by' => 'student'])
            ->assertOk()->assertJsonPath('data.receipt_document_id', $doc->getKey())->assertJsonPath('data.status', 'confirmed')->assertJsonPath('data.confirmed_by.id', $this->owner->getKey())
            ->assertJsonPath('data.reimbursement', 'none');
    }

    public function test_waived_requires_reason_and_cfc_advance_creates_reimbursement_to_settle(): void
    {
        $fee = $this->actingAsUser($this->owner)->postJson("{$this->base}/external-fees", [
            'qualification_process_id' => $this->process->getKey(), 'kind' => 'Taxa', 'obligor' => 'student',
        ])->assertCreated()->json('data.id');
        $status = "{$this->base}/external-fees/{$fee}/status";

        $this->actingAsUser($this->owner)->postJson($status, ['status' => 'waived'])->assertStatus(422)->assertJsonPath('error', 'reason_required');
        $this->actingAsUser($this->owner)->postJson($status, ['status' => 'confirmed', 'paid_by' => 'organization'])
            ->assertOk()->assertJsonPath('data.reimbursement', 'to_settle');

        $this->actingAsUser($this->owner)->postJson("{$this->base}/external-fees/{$fee}/reimbursement")->assertOk()->assertJsonPath('data.reimbursement', 'settled');
        $this->actingAsUser($this->owner)->postJson("{$this->base}/external-fees/{$fee}/reimbursement")->assertStatus(422);
    }

    public function test_shared_fee_is_a_single_record_linked_to_many_attempts(): void
    {
        $b1 = $this->exam('B')->assertCreated()->json('data.id');
        $a1 = $this->exam('A', 10, 11)->assertCreated()->json('data.id');

        $fee = $this->actingAsUser($this->owner)->postJson("{$this->base}/external-fees", [
            'qualification_process_id' => $this->process->getKey(), 'kind' => 'Taxa conjunta', 'amount_cents' => 5000, 'exam_ids' => [$a1, $b1],
        ])->assertCreated()->json('data.id');

        $list = $this->actingAsUser($this->owner)->getJson("{$this->base}/external-fees?qualification_process_id={$this->process->getKey()}")->json('data');
        $this->assertCount(1, $list);
        $this->assertEqualsCanonicalizing([$a1, $b1], $list[0]['exam_ids']);
        $this->assertSame($fee, $list[0]['id']);

        $other = $this->exam('B', 30)->assertStatus(422); // B ainda agendada → segue 1 única taxa
        $this->assertCount(1, $this->actingAsUser($this->owner)->getJson("{$this->base}/external-fees")->json('data'));
    }

    public function test_instructor_sees_only_own_summary_and_never_fees_or_other_exams(): void
    {
        $instructorUser = User::factory()->create();
        $this->addMember($this->org, $instructorUser, MembershipRole::Instructor);
        $mine = Instructor::factory()->create(['user_id' => $instructorUser->getKey()]);
        $this->org->instructors()->attach($mine->getKey(), ['active' => true]);

        $own = $this->exam('B', 10, 9, ['instructor_id' => $mine->getKey(), 'notes' => 'laudo X'])->assertCreated()->json('data.id');
        $this->exam('A', 10, 14, ['instructor_id' => $this->instructor->getKey()])->assertCreated();

        $rows = $this->actingAsUser($instructorUser)->getJson("{$this->base}/exams")->assertOk()->json('data');
        $this->assertCount(1, $rows);
        $this->assertSame($own, $rows[0]['id']);
        $this->assertArrayNotHasKey('registration', $rows[0]);
        $this->assertArrayNotHasKey('notes', $rows[0]);
        $this->assertArrayNotHasKey('fees', $rows[0]);

        $this->actingAsUser($instructorUser)->getJson("{$this->base}/exams/{$own}")->assertOk();
        $foreign = PracticalExam::query()->where('category', 'A')->firstOrFail();
        $this->actingAsUser($instructorUser)->getJson("{$this->base}/exams/{$foreign->getKey()}")->assertForbidden();
        $this->actingAsUser($instructorUser)->getJson("{$this->base}/external-fees")->assertForbidden();
        $this->actingAsUser($instructorUser)->postJson("{$this->base}/exams/{$own}/result", ['status' => 'approved'])->assertForbidden();
    }

    public function test_other_space_cannot_see_or_use_exams_and_filters_work(): void
    {
        $id = $this->exam('B')->assertCreated()->json('data.id');

        $outsider = User::factory()->create();
        $other = $this->organizationWithOwner('cfc', $outsider);
        $this->actingAsUser($outsider)->getJson($this->prefix."/organizations/{$other->getKey()}/exams/{$id}")->assertNotFound();
        $this->actingAsUser($outsider)->getJson($this->prefix."/organizations/{$other->getKey()}/exams")->assertOk()->assertJsonCount(0, 'data');

        $this->actingAsUser($this->owner)->getJson("{$this->base}/exams?category=A")->assertJsonCount(0, 'data');
        $this->actingAsUser($this->owner)->getJson("{$this->base}/exams?category=B&status=scheduled")->assertJsonCount(1, 'data');
        $this->actingAsUser($this->owner)->getJson("{$this->base}/exams?q=".urlencode(substr($this->student->name, 0, 3)))->assertJsonCount(1, 'data');
    }
}
