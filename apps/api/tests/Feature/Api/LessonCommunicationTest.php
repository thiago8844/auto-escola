<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\Student;
use App\Models\User;
use App\Notifications\LessonConfirmation;
use Illuminate\Support\Facades\Notification;

class LessonCommunicationTest extends ApiTestCase
{
    private User $owner;

    private Organization $organization;

    private Lesson $lesson;

    private Student $student;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->organization = $this->organizationWithOwner('cfc', $this->owner);
        $instructor = $this->linkInstructor($this->organization);
        $enrollment = $this->enrollmentFor($this->organization);
        $this->student = $enrollment->student;
        $this->student->update(['email' => 'aluna@example.com', 'phone' => '(31) 99999-1234']);
        [$start, $end] = $this->window();
        $this->lesson = $this->lessonFor($this->organization, $instructor, $enrollment, $start, $end);
    }

    private function base(): string
    {
        return "{$this->prefix}/organizations/{$this->organization->getKey()}/lessons/{$this->lesson->getKey()}/communications";
    }

    public function test_operator_previews_and_sends_one_email_for_the_current_lesson_time(): void
    {
        Notification::fake();

        $preview = $this->actingAsUser($this->owner)->getJson($this->base().'/preview')->assertOk();
        $preview->assertJsonPath('data.email', 'aluna@example.com')
            ->assertJsonPath('data.can_email', true);

        $this->postJson($this->base().'/email')->assertOk()->assertJsonPath('data.status', 'sent');
        $this->postJson($this->base().'/email')->assertOk()->assertJsonPath('data.status', 'sent');

        Notification::assertSentOnDemandTimes(LessonConfirmation::class, 1);
        $this->assertDatabaseCount('lesson_communications', 1);

        $this->lesson->update(['starts_at' => $this->lesson->starts_at->addHour(), 'ends_at' => $this->lesson->ends_at->addHour()]);
        $this->postJson($this->base().'/email')->assertOk();

        Notification::assertSentOnDemandTimes(LessonConfirmation::class, 2);
        $this->assertDatabaseCount('lesson_communications', 2);
    }

    public function test_whatsapp_opening_needs_a_separate_manual_sent_mark(): void
    {
        $response = $this->actingAsUser($this->owner)->postJson($this->base().'/whatsapp')->assertOk();
        $response->assertJsonPath('data.status', 'opened');
        $this->assertStringStartsWith('https://wa.me/5531999991234?text=', $response->json('url'));
        $communicationId = $response->json('data.id');

        $this->postJson($this->base()."/{$communicationId}/mark-sent")
            ->assertOk()
            ->assertJsonPath('data.status', 'marked_sent');

        $this->getJson($this->base())->assertOk()->assertJsonCount(1, 'data');
        $this->getJson("{$this->prefix}/organizations/{$this->organization->getKey()}/students/{$this->student->getKey()}/communications")
            ->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_missing_contact_and_past_lesson_are_rejected(): void
    {
        Notification::fake();
        $this->student->update(['email' => null, 'phone' => null]);

        $this->actingAsUser($this->owner)->postJson($this->base().'/email')->assertUnprocessable()->assertJsonPath('error', 'student_email_missing');
        $this->postJson($this->base().'/whatsapp')->assertUnprocessable()->assertJsonPath('error', 'student_phone_invalid');
        Notification::assertNothingSent();

        $this->lesson->update(['starts_at' => now()->subDay(), 'ends_at' => now()->subDay()->addHour()]);
        $this->postJson($this->base().'/whatsapp')->assertUnprocessable()->assertJsonPath('error', 'lesson_not_upcoming');
    }

    public function test_instructor_cannot_read_or_send_communications_and_other_space_cannot_access_lesson(): void
    {
        $instructorUser = User::factory()->create();
        $this->addMember($this->organization, $instructorUser, MembershipRole::Instructor);

        $this->actingAsUser($instructorUser)->getJson($this->base())->assertForbidden();
        $this->postJson($this->base().'/email')->assertForbidden();

        $otherOwner = User::factory()->create();
        $otherOrganization = $this->organizationWithOwner('cfc', $otherOwner);
        $otherBase = "{$this->prefix}/organizations/{$otherOrganization->getKey()}/lessons/{$this->lesson->getKey()}/communications";
        $this->actingAsUser($otherOwner)->getJson($otherBase)->assertNotFound();
    }
}
