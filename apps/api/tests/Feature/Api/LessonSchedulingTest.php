<?php

namespace Tests\Feature\Api;

use App\Enums\LessonStatus;
use App\Enums\MembershipRole;
use App\Models\Instructor;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\User;

class LessonSchedulingTest extends ApiTestCase
{
    private User $owner;

    private Organization $alfa;

    private Organization $beta;

    private Instructor $instructor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->alfa = $this->organizationWithOwner('cfc', $this->owner);
        $this->beta = $this->organizationWithOwner('cfc');
        $this->instructor = $this->linkInstructor($this->alfa);
        $this->beta->instructors()->attach($this->instructor->getKey(), ['active' => true]);
    }

    private function schedule(Organization $organization, string $start, string $end, ?User $as = null)
    {
        return $this->actingAsUser($as ?? $this->owner)->postJson(
            $this->prefix."/organizations/{$organization->getKey()}/lessons",
            [
                'enrollment_id' => $this->enrollmentFor($organization)->getKey(),
                'instructor_id' => $this->instructor->getKey(),
                'starts_at' => $start,
                'ends_at' => $end,
            ],
        );
    }

    public function test_schedules_lesson_with_scheduled_status(): void
    {
        [$start, $end] = $this->window(3, 9, 60);

        $this->schedule($this->alfa, $start, $end)
            ->assertCreated()
            ->assertJsonPath('data.status', 'scheduled');
    }

    public function test_conflict_within_same_organization_is_rejected(): void
    {
        [$start, $end] = $this->window(3, 9, 60);
        $this->schedule($this->alfa, $start, $end)->assertCreated();

        $this->schedule($this->alfa, $start, $end)
            ->assertConflict()
            ->assertJsonPath('message', 'Instrutor indisponível nesse horário.')
            ->assertJsonPath('error', 'instructor_unavailable');
    }

    public function test_conflict_across_organizations_is_rejected_without_revealing_the_other_one(): void
    {
        $betaOwner = $this->beta->members()->first();
        [$start, $end] = $this->window(3, 9, 60);
        $this->schedule($this->alfa, $start, $end)->assertCreated();

        [$overlapStart, $overlapEnd] = $this->window(3, 9, 30);
        $response = $this->schedule($this->beta, $overlapStart, $overlapEnd, $betaOwner)->assertConflict();

        $this->assertSame('Instrutor indisponível nesse horário.', $response->json('message'));
        $this->assertStringNotContainsString($this->alfa->name, $response->getContent());
    }

    public function test_adjacent_lessons_do_not_conflict(): void
    {
        [$start, $end] = $this->window(3, 9, 60);
        $this->schedule($this->alfa, $start, $end)->assertCreated();

        [$nextStart, $nextEnd] = $this->window(3, 10, 60);
        $this->schedule($this->alfa, $nextStart, $nextEnd)->assertCreated();
    }

    public function test_cancelled_lesson_does_not_block_the_slot(): void
    {
        [$start, $end] = $this->window(3, 9, 60);
        $lesson = $this->lessonFor($this->alfa, $this->instructor, $this->enrollmentFor($this->alfa), $start, $end);
        $lesson->update(['status' => LessonStatus::Cancelled]);

        $this->schedule($this->alfa, $start, $end)->assertCreated();
    }

    public function test_inactive_instructor_link_cannot_receive_new_lessons(): void
    {
        $this->alfa->instructors()->updateExistingPivot($this->instructor->getKey(), ['active' => false]);
        [$start, $end] = $this->window(3, 9, 60);

        $this->schedule($this->alfa, $start, $end)
            ->assertUnprocessable()
            ->assertJsonValidationErrors('instructor_id');
    }

    public function test_lesson_longer_than_limit_or_ending_before_start_is_rejected(): void
    {
        [$start] = $this->window(3, 9, 60);
        $tooLong = now()->utc()->addDays(3)->startOfDay()->addHours(9)->addMinutes(241)->toIso8601String();
        $beforeStart = now()->utc()->addDays(3)->startOfDay()->addHours(8)->toIso8601String();

        $this->schedule($this->alfa, $start, $tooLong)->assertUnprocessable()->assertJsonValidationErrors('ends_at');
        $this->schedule($this->alfa, $start, $beforeStart)->assertUnprocessable()->assertJsonValidationErrors('ends_at');
    }

    public function test_reschedule_into_conflict_is_rejected_and_reschedule_to_same_slot_is_allowed(): void
    {
        [$start, $end] = $this->window(3, 9, 60);
        $first = $this->lessonFor($this->alfa, $this->instructor, $this->enrollmentFor($this->alfa), $start, $end);
        [$otherStart, $otherEnd] = $this->window(3, 11, 60);
        $this->lessonFor($this->alfa, $this->instructor, $this->enrollmentFor($this->alfa), $otherStart, $otherEnd);

        $path = $this->prefix."/organizations/{$this->alfa->getKey()}/lessons/{$first->getKey()}/reschedule";

        $this->actingAsUser($this->owner)->postJson($path, ['starts_at' => $otherStart, 'ends_at' => $otherEnd])
            ->assertConflict()->assertJsonPath('error', 'instructor_unavailable');

        $this->actingAsUser($this->owner)->postJson($path, ['starts_at' => $start, 'ends_at' => $end])
            ->assertOk()->assertJsonPath('data.status', 'scheduled');

        [$newStart, $newEnd] = $this->window(4, 15, 60);
        $this->actingAsUser($this->owner)->postJson($path, ['starts_at' => $newStart, 'ends_at' => $newEnd])
            ->assertOk();
    }

    public function test_only_scheduled_lessons_can_be_rescheduled(): void
    {
        [$start, $end] = $this->window(3, 9, 60);
        $lesson = $this->lessonFor($this->alfa, $this->instructor, $this->enrollmentFor($this->alfa), $start, $end, LessonStatus::Completed);
        [$newStart, $newEnd] = $this->window(4, 9, 60);

        $this->actingAsUser($this->owner)
            ->postJson($this->prefix."/organizations/{$this->alfa->getKey()}/lessons/{$lesson->getKey()}/reschedule", [
                'starts_at' => $newStart,
                'ends_at' => $newEnd,
            ])->assertUnprocessable()->assertJsonPath('error', 'invalid_status_transition');
    }

    public function test_status_transitions_follow_the_state_machine(): void
    {
        [$start, $end] = $this->window(3, 9, 60);
        $lesson = $this->lessonFor($this->alfa, $this->instructor, $this->enrollmentFor($this->alfa), $start, $end);
        $path = $this->prefix."/organizations/{$this->alfa->getKey()}/lessons/{$lesson->getKey()}/status";

        // scheduled -> completed é permitido
        $this->actingAsUser($this->owner)->patchJson($path, ['status' => 'completed'])
            ->assertOk()->assertJsonPath('data.status', 'completed');

        // estado final não muda
        $this->actingAsUser($this->owner)->patchJson($path, ['status' => 'cancelled'])
            ->assertUnprocessable()->assertJsonPath('error', 'invalid_status_transition');
        $this->actingAsUser($this->owner)->patchJson($path, ['status' => 'missed'])
            ->assertUnprocessable()->assertJsonPath('error', 'invalid_status_transition');

        $this->assertSame(LessonStatus::Completed, $lesson->fresh()->status);
    }

    public function test_scheduled_lesson_can_be_marked_missed_or_cancelled(): void
    {
        [$start, $end] = $this->window(3, 9, 60);
        $missed = $this->lessonFor($this->alfa, $this->instructor, $this->enrollmentFor($this->alfa), $start, $end);
        [$start2, $end2] = $this->window(3, 11, 60);
        $cancelled = $this->lessonFor($this->alfa, $this->instructor, $this->enrollmentFor($this->alfa), $start2, $end2);

        $this->actingAsUser($this->owner)
            ->patchJson($this->prefix."/organizations/{$this->alfa->getKey()}/lessons/{$missed->getKey()}/status", ['status' => 'missed'])
            ->assertOk()->assertJsonPath('data.status', 'missed');

        $this->actingAsUser($this->owner)
            ->patchJson($this->prefix."/organizations/{$this->alfa->getKey()}/lessons/{$cancelled->getKey()}/status", ['status' => 'cancelled'])
            ->assertOk()->assertJsonPath('data.status', 'cancelled');
    }

    public function test_instructor_marks_only_own_lesson_as_completed_or_missed(): void
    {
        $instructorUser = User::factory()->create();
        $this->addMember($this->alfa, $instructorUser, MembershipRole::Instructor);
        $this->instructor->forceFill(['user_id' => $instructorUser->getKey()])->save();

        $colleague = $this->linkInstructor($this->alfa);
        [$start, $end] = $this->window(3, 9, 60);
        $own = $this->lessonFor($this->alfa, $this->instructor, $this->enrollmentFor($this->alfa), $start, $end);
        [$start2, $end2] = $this->window(3, 11, 60);
        $others = $this->lessonFor($this->alfa, $colleague, $this->enrollmentFor($this->alfa), $start2, $end2);

        $base = $this->prefix."/organizations/{$this->alfa->getKey()}/lessons";

        $this->actingAsUser($instructorUser)->patchJson("{$base}/{$own->getKey()}/status", ['status' => 'completed'])
            ->assertOk();

        [$start3, $end3] = $this->window(4, 9, 60);
        $ownCancel = $this->lessonFor($this->alfa, $this->instructor, $this->enrollmentFor($this->alfa), $start3, $end3);
        $this->actingAsUser($instructorUser)->patchJson("{$base}/{$ownCancel->getKey()}/status", ['status' => 'cancelled'])
            ->assertForbidden();

        $this->actingAsUser($instructorUser)->patchJson("{$base}/{$others->getKey()}/status", ['status' => 'completed'])
            ->assertForbidden();

        $this->actingAsUser($instructorUser)->getJson("{$base}/{$others->getKey()}")->assertForbidden();
    }

    public function test_instructor_cannot_create_or_reschedule_lessons(): void
    {
        $instructorUser = User::factory()->create();
        $this->addMember($this->alfa, $instructorUser, MembershipRole::Instructor);
        $this->instructor->forceFill(['user_id' => $instructorUser->getKey()])->save();
        [$start, $end] = $this->window(3, 9, 60);
        $lesson = $this->lessonFor($this->alfa, $this->instructor, $this->enrollmentFor($this->alfa), $start, $end);

        $this->schedule($this->alfa, $start, $end, $instructorUser)->assertForbidden();

        $this->actingAsUser($instructorUser)
            ->postJson($this->prefix."/organizations/{$this->alfa->getKey()}/lessons/{$lesson->getKey()}/reschedule", [
                'starts_at' => $start,
                'ends_at' => $end,
            ])->assertForbidden();
    }

    public function test_lesson_listing_is_scoped_and_filterable_by_status(): void
    {
        [$start, $end] = $this->window(3, 9, 60);
        $this->lessonFor($this->alfa, $this->instructor, $this->enrollmentFor($this->alfa), $start, $end);
        [$start2, $end2] = $this->window(3, 11, 60);
        $this->lessonFor($this->alfa, $this->instructor, $this->enrollmentFor($this->alfa), $start2, $end2, LessonStatus::Missed);

        $this->actingAsUser($this->owner)
            ->getJson($this->prefix."/organizations/{$this->alfa->getKey()}/lessons?status=missed")
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.status', 'missed');
    }

    public function test_lesson_outside_organization_path_returns_not_found(): void
    {
        [$start, $end] = $this->window(3, 9, 60);
        $betaLesson = $this->lessonFor($this->beta, $this->instructor, $this->enrollmentFor($this->beta), $start, $end);

        $this->actingAsUser($this->owner)
            ->getJson($this->prefix."/organizations/{$this->alfa->getKey()}/lessons/{$betaLesson->getKey()}")
            ->assertNotFound();

        $this->assertInstanceOf(Lesson::class, $betaLesson);
    }
}
