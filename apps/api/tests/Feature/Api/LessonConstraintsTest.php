<?php

namespace Tests\Feature\Api;

use App\Enums\LicenseCategory;
use App\Enums\VehicleStatus;
use App\Models\Enrollment;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\User;

/**
 * Veículo, aluno e matrícula na agenda.
 */
class LessonConstraintsTest extends ApiTestCase
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

    private function schedule(Enrollment $enrollment, array $window, ?int $vehicleId = null, ?Instructor $instructor = null)
    {
        return $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons", array_filter([
            'enrollment_id' => $enrollment->getKey(),
            'instructor_id' => ($instructor ?? $this->instructor)->getKey(),
            'vehicle_id' => $vehicleId,
            'starts_at' => $window[0],
            'ends_at' => $window[1],
        ], fn ($v) => $v !== null));
    }

    public function test_lesson_with_vehicle_returns_it_in_the_response(): void
    {
        $vehicle = $this->vehicleFor($this->org, overrides: ['plate' => 'ABC1D23']);

        $this->schedule($this->enrollmentFor($this->org), $this->window(), $vehicle->getKey())
            ->assertCreated()
            ->assertJsonPath('data.vehicle.plate', 'ABC1D23')
            ->assertJsonPath('data.scheduled_minutes', 60)
            ->assertJsonPath('data.registry.status', 'not_informed');
    }

    public function test_vehicle_cannot_be_double_booked(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $secondInstructor = $this->linkInstructor($this->org);

        $this->schedule($this->enrollmentFor($this->org), $this->window(), $vehicle->getKey())->assertCreated();

        $this->schedule($this->enrollmentFor($this->org), $this->window(3, 9, 30), $vehicle->getKey(), $secondInstructor)
            ->assertConflict()->assertJsonPath('error', 'vehicle_unavailable');

        // Mesmo horário, sem veículo, outro instrutor: livre.
        $this->schedule($this->enrollmentFor($this->org), $this->window(), null, $secondInstructor)->assertCreated();
    }

    public function test_student_cannot_have_two_lessons_at_the_same_time_even_in_different_enrollments(): void
    {
        $enrollmentB = $this->enrollmentFor($this->org);
        $enrollmentA = Enrollment::create([
            'organization_id' => $this->org->getKey(),
            'student_id' => $enrollmentB->student_id,
            'category' => LicenseCategory::A,
        ]);
        $secondInstructor = $this->linkInstructor($this->org);

        $this->schedule($enrollmentB, $this->window())->assertCreated();

        $this->schedule($enrollmentA, $this->window(3, 9, 30), null, $secondInstructor)
            ->assertConflict()->assertJsonPath('error', 'student_unavailable');
    }

    public function test_cancelled_lesson_frees_vehicle_and_student(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $enrollment = $this->enrollmentFor($this->org);
        $window = $this->window();
        $id = $this->schedule($enrollment, $window, $vehicle->getKey())->assertCreated()->json('data.id');

        $this->actingAsUser($this->owner)
            ->patchJson("{$this->base}/lessons/{$id}/status", ['status' => 'cancelled', 'reason' => 'Chuva forte'])
            ->assertOk()->assertJsonPath('data.status_reason', 'Chuva forte');

        $this->schedule($enrollment, $window, $vehicle->getKey())->assertCreated();
    }

    public function test_vehicle_category_must_match_the_enrollment(): void
    {
        $motorcycle = $this->vehicleFor($this->org, LicenseCategory::A);

        $this->schedule($this->enrollmentFor($this->org), $this->window(), $motorcycle->getKey())
            ->assertUnprocessable()->assertJsonPath('error', 'vehicle_category_mismatch');
    }

    public function test_ab_enrollment_accepts_vehicles_of_either_path(): void
    {
        $enrollment = $this->enrollmentFor($this->org);
        $enrollment->update(['category' => LicenseCategory::AB]);
        $this->instructor->update(['categories' => ['AB']]);
        $moto = $this->vehicleFor($this->org, LicenseCategory::A);
        $car = $this->vehicleFor($this->org, LicenseCategory::B);

        $this->schedule($enrollment, $this->window(3, 9), $moto->getKey())->assertCreated();
        $this->schedule($enrollment, $this->window(3, 11), $car->getKey())->assertCreated();
    }

    public function test_instructor_must_teach_the_vehicle_category_when_categories_are_registered(): void
    {
        $motoOnly = Instructor::factory()->create(['categories' => ['A']]);
        $this->org->instructors()->attach($motoOnly->getKey(), ['active' => true]);
        $car = $this->vehicleFor($this->org, LicenseCategory::B);

        $this->schedule($this->enrollmentFor($this->org), $this->window(), $car->getKey(), $motoOnly)
            ->assertUnprocessable()->assertJsonPath('error', 'instructor_category_mismatch');
    }

    public function test_inactive_vehicle_is_rejected(): void
    {
        $vehicle = $this->vehicleFor($this->org, overrides: ['status' => VehicleStatus::Inactive]);

        $this->schedule($this->enrollmentFor($this->org), $this->window(), $vehicle->getKey())
            ->assertUnprocessable()->assertJsonPath('error', 'vehicle_inactive');
    }

    public function test_expired_crlv_blocks_lessons_after_the_expiry_date_only(): void
    {
        $vehicle = $this->vehicleFor($this->org, overrides: ['crlv_expires_at' => now()->addDays(5)->toDateString()]);

        $this->schedule($this->enrollmentFor($this->org), $this->window(3), $vehicle->getKey())->assertCreated();

        $this->schedule($this->enrollmentFor($this->org), $this->window(7), $vehicle->getKey())
            ->assertUnprocessable()->assertJsonPath('error', 'vehicle_document_expired');
    }

    public function test_vehicle_from_another_organization_is_rejected(): void
    {
        $foreign = $this->vehicleFor($this->organizationWithOwner());

        $this->schedule($this->enrollmentFor($this->org), $this->window(), $foreign->getKey())
            ->assertUnprocessable()->assertJsonValidationErrors('vehicle_id');
    }

    public function test_closed_enrollment_does_not_accept_lessons(): void
    {
        $enrollment = $this->enrollmentFor($this->org);
        $enrollment->update(['status' => 'terminated']);

        $this->schedule($enrollment, $this->window())
            ->assertUnprocessable()->assertJsonPath('error', 'enrollment_closed');
    }

    public function test_reschedule_checks_vehicle_and_student(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $secondInstructor = $this->linkInstructor($this->org);

        $this->schedule($this->enrollmentFor($this->org), $this->window(3, 9), $vehicle->getKey())->assertCreated();
        $enrollment = $this->enrollmentFor($this->org);
        $other = $this->schedule($enrollment, $this->window(3, 11), $vehicle->getKey(), $secondInstructor)
            ->assertCreated()->json('data.id');

        // Mesmo veículo ocupado às 9h.
        [$start, $end] = $this->window(3, 9);
        $this->actingAsUser($this->owner)
            ->postJson("{$this->base}/lessons/{$other}/reschedule", ['starts_at' => $start, 'ends_at' => $end])
            ->assertConflict()->assertJsonPath('error', 'vehicle_unavailable');

        // O próprio horário da aula não conflita consigo mesma.
        [$start, $end] = $this->window(3, 11, 30);
        $this->actingAsUser($this->owner)
            ->postJson("{$this->base}/lessons/{$other}/reschedule", ['starts_at' => $start, 'ends_at' => $end])
            ->assertOk();
    }

    public function test_reschedule_into_the_students_other_lesson_is_rejected(): void
    {
        $enrollment = $this->enrollmentFor($this->org);
        $secondInstructor = $this->linkInstructor($this->org);

        $this->schedule($enrollment, $this->window(3, 9))->assertCreated();
        $id = $this->schedule($enrollment, $this->window(3, 13), null, $secondInstructor)->assertCreated()->json('data.id');

        [$start, $end] = $this->window(3, 9);
        $this->actingAsUser($this->owner)
            ->postJson("{$this->base}/lessons/{$id}/reschedule", ['starts_at' => $start, 'ends_at' => $end])
            ->assertConflict()->assertJsonPath('error', 'student_unavailable');
    }
}
