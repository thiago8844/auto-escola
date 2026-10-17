<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\User;

/**
 * Execução da aula: liberação para a prática, duração real, evolução e registro oficial.
 */
class LessonExecutionTest extends ApiTestCase
{
    private User $owner;

    private Organization $org;

    private Instructor $instructor;

    private string $base;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->org = $this->organizationWithOwner('cfc', $this->owner);
        $this->instructor = $this->linkInstructor($this->org);
        $this->base = $this->prefix."/organizations/{$this->org->getKey()}";
    }

    private function lesson($enrollment, int $hour = 9): int
    {
        [$start, $end] = $this->window(3, $hour, 50);

        return $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons", [
            'enrollment_id' => $enrollment->getKey(),
            'instructor_id' => $this->instructor->getKey(),
            'starts_at' => $start,
            'ends_at' => $end,
        ])->assertCreated()->json('data.id');
    }

    private function setStatus(int $lessonId, array $data)
    {
        return $this->actingAsUser($this->owner)->patchJson("{$this->base}/lessons/{$lessonId}/status", $data);
    }

    public function test_enrollment_without_process_can_complete_lessons(): void
    {
        $id = $this->lesson($this->enrollmentFor($this->org));

        $this->setStatus($id, ['status' => 'completed'])->assertOk()->assertJsonPath('data.status', 'completed');
    }

    public function test_lesson_can_be_scheduled_before_release_but_not_completed(): void
    {
        [$process, $enrollment] = $this->processWithEnrollment($this->org, $this->owner);

        $id = $this->lesson($enrollment); // pré-reserva permitida

        $this->setStatus($id, ['status' => 'completed'])
            ->assertUnprocessable()
            ->assertJsonPath('error', 'practice_not_released');

        $this->assertDatabaseHas('lessons', ['id' => $id, 'status' => 'scheduled']);

        // Falta e cancelamento não dependem da liberação.
        $this->setStatus($id, ['status' => 'missed'])->assertOk();
    }

    public function test_pending_items_are_named_in_the_error(): void
    {
        [, $enrollment] = $this->processWithEnrollment($this->org, $this->owner);
        $id = $this->lesson($enrollment);

        $message = $this->setStatus($id, ['status' => 'completed'])->json('message');

        $this->assertStringContainsString('licença de aprendizagem', $message);
        $this->assertStringContainsString('avaliação médica', $message);
    }

    public function test_lesson_completes_after_practice_is_released(): void
    {
        [$process, $enrollment] = $this->processWithEnrollment($this->org, $this->owner);
        $id = $this->lesson($enrollment);
        $this->releasePractice($process, $this->owner);

        $this->setStatus($id, ['status' => 'completed'])->assertOk();
    }

    public function test_declared_but_unverified_item_does_not_release_practice(): void
    {
        [$process, $enrollment] = $this->processWithEnrollment($this->org, $this->owner);
        $id = $this->lesson($enrollment);

        $this->releasePractice($process, $this->owner);
        $process->checklistItems()->where('type', 'theory_completion')->update(['status' => 'done']);

        $this->setStatus($id, ['status' => 'completed'])
            ->assertUnprocessable()
            ->assertJsonPath('error', 'practice_not_released');
    }

    public function test_actual_minutes_default_to_scheduled_and_can_be_informed(): void
    {
        $enrollment = $this->enrollmentFor($this->org);
        $first = $this->lesson($enrollment, 9);
        $second = $this->lesson($enrollment, 11);

        $this->setStatus($first, ['status' => 'completed'])
            ->assertOk()->assertJsonPath('data.actual_minutes', 50)->assertJsonPath('data.scheduled_minutes', 50);

        $this->setStatus($second, ['status' => 'completed', 'actual_minutes' => 40, 'evolution' => 'Treinou baliza; precisa melhorar embreagem.'])
            ->assertOk()
            ->assertJsonPath('data.actual_minutes', 40)
            ->assertJsonPath('data.scheduled_minutes', 50)
            ->assertJsonPath('data.evolution', 'Treinou baliza; precisa melhorar embreagem.');
    }

    public function test_completing_twice_is_rejected_so_nothing_counts_double(): void
    {
        $id = $this->lesson($this->enrollmentFor($this->org));
        $this->setStatus($id, ['status' => 'completed', 'actual_minutes' => 45])->assertOk();

        $this->setStatus($id, ['status' => 'completed', 'actual_minutes' => 90])
            ->assertUnprocessable()->assertJsonPath('error', 'invalid_status_transition');

        $this->assertDatabaseHas('lessons', ['id' => $id, 'actual_minutes' => 45]);
    }

    public function test_execution_fields_are_only_valid_for_the_right_status(): void
    {
        $id = $this->lesson($this->enrollmentFor($this->org));

        $this->setStatus($id, ['status' => 'missed', 'actual_minutes' => 30])
            ->assertUnprocessable()->assertJsonValidationErrors('actual_minutes');
        $this->setStatus($id, ['status' => 'completed', 'reason' => 'x'])
            ->assertUnprocessable()->assertJsonValidationErrors('reason');

        $this->setStatus($id, ['status' => 'missed', 'reason' => 'Aluno não compareceu'])
            ->assertOk()->assertJsonPath('data.status_reason', 'Aluno não compareceu');
    }

    public function test_instructor_records_evolution_on_own_completed_lesson_only(): void
    {
        $user = User::factory()->create();
        $this->addMember($this->org, $user, MembershipRole::Instructor);
        $mine = $this->linkInstructor($this->org, $user);
        $enrollment = $this->enrollmentFor($this->org);

        [$start, $end] = $this->window(3, 15, 50);
        $ownId = $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons", [
            'enrollment_id' => $enrollment->getKey(), 'instructor_id' => $mine->getKey(),
            'starts_at' => $start, 'ends_at' => $end,
        ])->json('data.id');
        $othersId = $this->lesson($this->enrollmentFor($this->org), 9);

        // Ainda agendada: evolução não se aplica.
        $this->actingAsUser($user)->patchJson("{$this->base}/lessons/{$ownId}", ['evolution' => 'x'])
            ->assertUnprocessable()->assertJsonPath('error', 'lesson_not_completed');

        $this->actingAsUser($user)->patchJson("{$this->base}/lessons/{$ownId}/status", ['status' => 'completed'])->assertOk();
        $this->actingAsUser($user)->patchJson("{$this->base}/lessons/{$ownId}", ['evolution' => 'Boa evolução.', 'actual_minutes' => 48])
            ->assertOk()->assertJsonPath('data.evolution', 'Boa evolução.')->assertJsonPath('data.actual_minutes', 48);

        $this->actingAsUser($user)->patchJson("{$this->base}/lessons/{$othersId}", ['notes' => 'x'])->assertForbidden();
    }

    public function test_registry_requires_completed_lesson_and_evidence_to_confirm(): void
    {
        $id = $this->lesson($this->enrollmentFor($this->org));
        $url = "{$this->base}/lessons/{$id}/registry";

        $this->actingAsUser($this->owner)->patchJson($url, ['registry_status' => 'pending'])
            ->assertUnprocessable()->assertJsonPath('error', 'lesson_not_completed');

        $this->setStatus($id, ['status' => 'completed'])->assertOk();

        $this->actingAsUser($this->owner)->patchJson($url, ['registry_status' => 'confirmed'])
            ->assertUnprocessable()->assertJsonPath('error', 'registry_evidence_required');

        $this->actingAsUser($this->owner)->patchJson($url, ['registry_status' => 'confirmed', 'registry_reference' => 'PROT-2026-123'])
            ->assertOk()
            ->assertJsonPath('data.registry.status', 'confirmed')
            ->assertJsonPath('data.registry.reference', 'PROT-2026-123');
    }

    public function test_completing_does_not_imply_official_registry(): void
    {
        $id = $this->lesson($this->enrollmentFor($this->org));

        $this->setStatus($id, ['status' => 'completed'])->assertOk()
            ->assertJsonPath('data.registry.status', 'not_informed');
    }

    public function test_instructor_cannot_set_the_official_registry(): void
    {
        $user = User::factory()->create();
        $this->addMember($this->org, $user, MembershipRole::Instructor);
        $mine = $this->linkInstructor($this->org, $user);
        $enrollment = $this->enrollmentFor($this->org);
        [$start, $end] = $this->window(3, 15, 50);
        $id = $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons", [
            'enrollment_id' => $enrollment->getKey(), 'instructor_id' => $mine->getKey(),
            'starts_at' => $start, 'ends_at' => $end,
        ])->json('data.id');

        $this->actingAsUser($user)->patchJson("{$this->base}/lessons/{$id}/registry", ['registry_status' => 'pending'])
            ->assertForbidden();
    }

    public function test_enrollment_exposes_release_summary_but_hides_price_from_instructors(): void
    {
        [, $enrollment] = $this->processWithEnrollment($this->org, $this->owner);
        $enrollment->update(['price_cents' => 150000, 'contracted_minutes' => 600]);
        $user = User::factory()->create();
        $this->addMember($this->org, $user, MembershipRole::Instructor);
        $mine = $this->linkInstructor($this->org, $user);
        [$start, $end] = $this->window(3, 15, 50);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons", [
            'enrollment_id' => $enrollment->getKey(), 'instructor_id' => $mine->getKey(),
            'starts_at' => $start, 'ends_at' => $end,
        ])->assertCreated();

        $this->actingAsUser($this->owner)->getJson("{$this->base}/enrollments/{$enrollment->getKey()}")
            ->assertOk()
            ->assertJsonPath('data.price_cents', 150000)
            ->assertJsonPath('data.contracted_minutes', 600)
            ->assertJsonPath('data.practice_release.released', false);

        $this->actingAsUser($user)->getJson("{$this->base}/enrollments/{$enrollment->getKey()}")
            ->assertOk()
            ->assertJsonMissingPath('data.price_cents')
            ->assertJsonPath('data.practice_release.released', false)
            ->assertJsonStructure(['data' => ['practice_release' => ['pending']]]);
    }

    public function test_enrollment_process_must_belong_to_same_student_and_cover_category(): void
    {
        [$process] = $this->processWithEnrollment($this->org, $this->owner);
        $otherStudent = $this->enrollmentFor($this->org)->student;
        $url = "{$this->base}/enrollments";

        $this->actingAsUser($this->owner)->postJson($url, [
            'student_id' => $otherStudent->getKey(), 'category' => 'B', 'qualification_process_id' => $process->getKey(),
        ])->assertUnprocessable()->assertJsonValidationErrors('qualification_process_id');

        $this->actingAsUser($this->owner)->postJson($url, [
            'student_id' => $process->student_id, 'category' => 'C', 'qualification_process_id' => $process->getKey(),
        ])->assertUnprocessable()->assertJsonValidationErrors('category');

        $this->actingAsUser($this->owner)->postJson($url, [
            'student_id' => $process->student_id, 'category' => 'B', 'qualification_process_id' => $process->getKey(),
            'contracted_minutes' => 1200, 'price_cents' => 250000, 'status' => 'in_service',
        ])->assertCreated()->assertJsonPath('data.status', 'in_service')->assertJsonPath('data.contracted_minutes', 1200);
    }
}
