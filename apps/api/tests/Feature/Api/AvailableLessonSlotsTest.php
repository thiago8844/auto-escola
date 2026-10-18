<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\AvailabilityBlock;
use App\Models\User;
use Carbon\CarbonImmutable;

class AvailableLessonSlotsTest extends ApiTestCase
{
    public function test_sugere_sem_conflito_de_instrutor_aluno_ou_veiculo_e_nao_reserva_saldo(): void
    {
        $organization = $this->organizationWithOwner()->refresh();
        $owner = $organization->members()->first();
        $instructor = $this->linkInstructor($organization);
        $otherInstructor = $this->linkInstructor($organization);
        $vehicle = $this->vehicleFor($organization);
        $otherEnrollment = $this->enrollmentFor($organization);
        $enrollment = $this->enrollmentFor($organization);
        $date = now($organization->timezone)->addDays(3)->toDateString();
        $at = fn (string $time) => CarbonImmutable::parse("{$date} {$time}", $organization->timezone)->utc()->toIso8601String();
        $this->lessonFor($organization, $instructor, $otherEnrollment, $at('08:00'), $at('09:00'));
        $this->lessonFor($organization, $otherInstructor, $enrollment, $at('09:00'), $at('10:00'));
        $lesson = $this->lessonFor($organization, $otherInstructor, $otherEnrollment, $at('10:00'), $at('11:00'));
        $lesson->update(['vehicle_id' => $vehicle->id]);

        $response = $this->actingAsUser($owner)->getJson($this->prefix."/organizations/{$organization->id}/lesson-slots?".http_build_query([
            'enrollment_id' => $enrollment->id, 'instructor_id' => $instructor->id, 'vehicle_id' => $vehicle->id,
            'date' => $date, 'duration' => 50,
        ]))->assertOk()->assertJsonCount(5, 'data');
        $this->assertSame($at('11:00'), $response->json('data.0.starts_at'));
        $this->assertDatabaseCount('lessons', 3);
        $this->assertDatabaseCount('enrollment_credit_entries', 0);
    }

    public function test_respeita_expediente_bloqueio_pessoal_externo_e_manutencao(): void
    {
        $organization = $this->organizationWithOwner()->refresh();
        $instructor = $this->linkInstructor($organization);
        $enrollment = $this->enrollmentFor($organization);
        $vehicle = $this->vehicleFor($organization);
        $day = CarbonImmutable::now($organization->timezone)->addDays(3)->startOfDay();
        $organization->update(['business_hours' => [$day->isoWeekday() => [['start' => '09:00', 'end' => '13:00']]]]);
        $other = $this->organizationWithOwner();
        $other->instructors()->attach($instructor->id, ['active' => true]);
        AvailabilityBlock::create([
            'organization_id' => $other->id, 'resource_type' => 'instructor', 'instructor_id' => $instructor->id,
            'scope' => 'personal', 'kind' => 'absence', 'starts_at' => $day->setTime(9, 0)->utc(), 'ends_at' => $day->setTime(10, 0)->utc(),
        ]);
        AvailabilityBlock::create([
            'organization_id' => $organization->id, 'resource_type' => 'vehicle', 'vehicle_id' => $vehicle->id,
            'scope' => 'organization', 'kind' => 'maintenance', 'starts_at' => $day->setTime(10, 0)->utc(), 'ends_at' => $day->setTime(11, 0)->utc(),
        ]);
        $response = $this->actingAsUser($organization->members()->first())->getJson($this->prefix."/organizations/{$organization->id}/lesson-slots?".http_build_query([
            'enrollment_id' => $enrollment->id, 'instructor_id' => $instructor->id, 'vehicle_id' => $vehicle->id,
            'date' => $day->toDateString(), 'duration' => 50,
        ]))->assertOk();
        $this->assertSame($day->setTime(11, 0)->utc()->toIso8601String(), $response->json('data.0.starts_at'));
    }

    public function test_instrutor_nao_consulta_agenda_de_colega_e_cfc_nao_consulta_recursos_externos(): void
    {
        $organization = $this->organizationWithOwner()->refresh();
        $user = User::factory()->create();
        $this->addMember($organization, $user, MembershipRole::Instructor);
        $base = $this->prefix."/organizations/{$organization->id}/lesson-slots";
        $this->actingAsUser($user)->getJson($base)->assertForbidden();
        $other = $this->organizationWithOwner();
        $enrollment = $this->enrollmentFor($other);
        $instructor = $this->linkInstructor($other);
        $this->actingAsUser($organization->members()->first())->getJson($base.'?'.http_build_query([
            'enrollment_id' => $enrollment->id, 'instructor_id' => $instructor->id, 'date' => now()->addDays(3)->toDateString(), 'duration' => 50,
        ]))->assertUnprocessable()->assertJsonValidationErrors(['enrollment_id', 'instructor_id']);
    }
}
