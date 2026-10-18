<?php

namespace Tests\Feature\Api;

use App\Enums\LessonStatus;
use App\Enums\MembershipRole;
use App\Models\AvailabilityBlock;
use App\Models\Document;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Módulo 4 — disponibilidade e frota.
 */
class AvailabilityTest extends ApiTestCase
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

    private function book(int $enrollmentId, array $window, array $extra = [])
    {
        return $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons", $extra + [
            'enrollment_id' => $enrollmentId,
            'instructor_id' => $this->instructor->getKey(),
            'starts_at' => $window[0],
            'ends_at' => $window[1],
        ]);
    }

    private function block(array $data)
    {
        return $this->actingAsUser($this->owner)->postJson("{$this->base}/availability-blocks", $data);
    }

    public function test_aceite_vehicle_in_maintenance_exposes_affected_lessons_and_blocks_new_bookings_until_release(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $enrollment = $this->enrollmentFor($this->org);
        $window = $this->window(3, 9);
        $existing = $this->book($enrollment->getKey(), $window, ['vehicle_id' => $vehicle->getKey()])->assertCreated()->json('data.id');

        $maintenance = $this->actingAsUser($this->owner)->postJson("{$this->base}/maintenances", [
            'vehicle_id' => $vehicle->getKey(),
            'type' => 'Revisão',
            'scheduled_on' => now()->addDays(3)->toDateString(),
            'provider' => 'Oficina Central',
            'estimated_cost_cents' => 45000,
            'block' => ['starts_at' => now()->addDays(2)->toIso8601String(), 'ends_at' => now()->addDays(5)->toIso8601String()],
        ])->assertCreated()
            ->assertJsonPath('meta.affected.0.id', $existing)
            ->assertJsonPath('meta.affected.0.type', 'lesson')
            ->assertJsonPath('data.block.status', 'active');

        $financeRef = $maintenance->json('data.finance_ref');
        $this->assertNotEmpty($financeRef);

        // Nada foi cancelado.
        $this->assertSame(LessonStatus::Scheduled, \App\Models\Lesson::findOrFail($existing)->status);

        // Nova reserva conflitante com o veículo é recusada, com orientação.
        $other = $this->enrollmentFor($this->org);
        $second = $this->linkInstructor($this->org);
        $this->book($other->getKey(), $this->window(4, 9), ['vehicle_id' => $vehicle->getKey(), 'instructor_id' => $second->getKey()])
            ->assertStatus(409)
            ->assertJsonPath('error', 'vehicle_blocked');

        // Concluir o serviço libera o bloqueio e mantém o histórico.
        $this->actingAsUser($this->owner)->postJson("{$this->base}/maintenances/{$maintenance->json('data.id')}/complete", [
            'actual_cost_cents' => 47000, 'odometer_km' => 51000, 'next_due_date' => now()->addMonths(6)->toDateString(), 'next_due_km' => 61000,
        ])->assertOk()->assertJsonPath('data.status', 'done')->assertJsonPath('data.block.status', 'released')
            ->assertJsonPath('data.finance_ref', $financeRef);

        $this->book($other->getKey(), $this->window(4, 9), ['vehicle_id' => $vehicle->getKey(), 'instructor_id' => $second->getKey()])->assertCreated();
        $this->assertDatabaseHas('availability_blocks', ['vehicle_id' => $vehicle->getKey(), 'status' => 'released']);
        $this->assertDatabaseHas('audit_events', ['organization_id' => $this->org->getKey(), 'event' => 'availability.released']);
    }

    public function test_organization_block_for_instructor_prevents_booking_and_reschedule(): void
    {
        $enrollment = $this->enrollmentFor($this->org);
        $lesson = $this->book($enrollment->getKey(), $this->window(3, 9))->assertCreated()->json('data.id');

        $this->block([
            'resource_type' => 'instructor', 'instructor_id' => $this->instructor->getKey(), 'kind' => 'vacation',
            'starts_at' => now()->addDays(6)->startOfDay()->toIso8601String(), 'ends_at' => now()->addDays(10)->startOfDay()->toIso8601String(),
            'reason' => 'Férias de verão',
        ])->assertCreated()->assertJsonPath('data.kind_label', 'Férias');

        $this->book($enrollment->getKey(), $this->window(7, 9))->assertStatus(409)->assertJsonPath('error', 'instructor_blocked');

        [$start, $end] = $this->window(7, 9);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons/{$lesson}/reschedule", ['starts_at' => $start, 'ends_at' => $end])
            ->assertStatus(409)->assertJsonPath('error', 'instructor_blocked');
    }

    public function test_personal_unavailability_applies_across_spaces_without_revealing_details(): void
    {
        $user = User::factory()->create();
        $instructor = Instructor::factory()->create(['user_id' => $user->getKey()]);
        $other = $this->organizationWithOwner('cfc');
        $this->org->instructors()->attach($instructor->getKey(), ['active' => true]);
        $other->instructors()->attach($instructor->getKey(), ['active' => true]);
        $this->addMember($this->org, $user, MembershipRole::Instructor);

        // Criada no espaço A pelo próprio instrutor.
        $this->actingAsUser($user)->postJson("{$this->base}/availability-blocks", [
            'resource_type' => 'instructor', 'instructor_id' => $instructor->getKey(), 'scope' => 'personal', 'kind' => 'absence',
            'starts_at' => now()->addDays(3)->startOfDay()->toIso8601String(), 'ends_at' => now()->addDays(4)->startOfDay()->toIso8601String(),
            'reason' => 'Consulta médica',
        ])->assertCreated();

        // Espaço B não consegue agendar e não vê o motivo nem o espaço de origem.
        $enrollment = $this->enrollmentFor($other);
        $window = $this->window(3, 9);
        $response = $this->actingAsUser($other->members()->first())->postJson($this->prefix."/organizations/{$other->getKey()}/lessons", [
            'enrollment_id' => $enrollment->getKey(), 'instructor_id' => $instructor->getKey(), 'starts_at' => $window[0], 'ends_at' => $window[1],
        ])->assertStatus(409)->assertJsonPath('error', 'instructor_unavailable');
        $this->assertStringNotContainsString('médica', $response->getContent());

        $list = $this->actingAsUser($other->members()->first())
            ->getJson($this->prefix."/organizations/{$other->getKey()}/availability-blocks")->assertOk();
        $list->assertJsonPath('data.0.external', true)->assertJsonPath('data.0.reason', null)->assertJsonPath('data.0.created_by', null);

        // Equipe do espaço A (onde foi criada) não altera a indisponibilidade pessoal do instrutor.
        $id = AvailabilityBlock::firstOrFail()->getKey();
        $this->actingAsUser($this->owner)->postJson("{$this->base}/availability-blocks/{$id}/release")->assertForbidden();
    }

    public function test_permissions_for_creating_blocks(): void
    {
        $staff = User::factory()->create();
        $this->addMember($this->org, $staff, MembershipRole::Staff);
        $vehicle = $this->vehicleFor($this->org);
        $payload = ['resource_type' => 'vehicle', 'vehicle_id' => $vehicle->getKey(), 'kind' => 'other', 'reason' => 'Lavagem',
            'starts_at' => now()->addDay()->toIso8601String(), 'ends_at' => now()->addDays(2)->toIso8601String()];

        $this->actingAsUser($staff)->postJson("{$this->base}/availability-blocks", $payload)->assertCreated();

        $instructorUser = User::factory()->create();
        $mine = Instructor::factory()->create(['user_id' => $instructorUser->getKey()]);
        $this->org->instructors()->attach($mine->getKey(), ['active' => true]);
        $this->addMember($this->org, $instructorUser, MembershipRole::Instructor);

        $this->actingAsUser($instructorUser)->postJson("{$this->base}/availability-blocks", $payload)->assertForbidden();
        // Não pode bloquear a agenda de um colega, nem como pessoal nem como espaço.
        $colleague = $this->instructor;
        foreach (['personal', 'organization'] as $scope) {
            $this->actingAsUser($instructorUser)->postJson("{$this->base}/availability-blocks", [
                'resource_type' => 'instructor', 'instructor_id' => $colleague->getKey(), 'scope' => $scope, 'kind' => 'absence', 'reason' => 'Teste',
                'starts_at' => now()->addDay()->toIso8601String(), 'ends_at' => now()->addDays(2)->toIso8601String(),
            ])->assertForbidden();
        }
    }

    public function test_exam_scheduling_respects_vehicle_block(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $this->block(['resource_type' => 'vehicle', 'vehicle_id' => $vehicle->getKey(), 'kind' => 'maintenance', 'reason' => 'Freios',
            'starts_at' => now()->addDays(9)->startOfDay()->toIso8601String(), 'ends_at' => now()->addDays(11)->startOfDay()->toIso8601String()])->assertCreated();

        [$process] = $this->processWithEnrollment($this->org, $this->owner);
        [$start] = $this->window(10, 9);

        $this->actingAsUser($this->owner)->postJson("{$this->base}/exams", [
            'qualification_process_id' => $process->getKey(), 'category' => 'B', 'scheduled_at' => $start, 'vehicle_id' => $vehicle->getKey(),
        ])->assertStatus(409)->assertJsonPath('error', 'vehicle_blocked');
    }

    public function test_business_hours_are_optional_and_exceptions_need_a_reason(): void
    {
        $enrollment = $this->enrollmentFor($this->org);

        // Sem regra: agenda livre.
        $this->book($enrollment->getKey(), $this->window(3, 4))->assertCreated();

        $hours = array_fill_keys(['1', '2', '3', '4', '5'], [['start' => '08:00', 'end' => '18:00']]);
        $this->actingAsUser($this->owner)->patchJson($this->base, ['business_hours' => $hours])
            ->assertOk()->assertJsonPath('data.business_hours.1.0.start', '08:00');

        $outside = $this->localWindow(5, '20:00', '21:00');
        $this->book($enrollment->getKey(), $outside)->assertStatus(422)->assertJsonPath('error', 'outside_business_hours');

        $this->book($enrollment->getKey(), $outside, ['hours_override_reason' => 'Aula noturna combinada'])->assertCreated();
        $this->assertDatabaseHas('audit_events', ['event' => 'lesson.scheduled', 'organization_id' => $this->org->getKey()]);

        $inside = $this->localWindow(6, '10:00', '11:00');
        $this->book($enrollment->getKey(), $inside)->assertCreated();

        // Voltar à agenda livre.
        $this->actingAsUser($this->owner)->patchJson($this->base, ['business_hours' => null])->assertOk()->assertJsonPath('data.business_hours', null);
    }

    public function test_instructor_weekly_hours_are_enforced_and_shown(): void
    {
        $enrollment = $this->enrollmentFor($this->org);
        $monday = CarbonImmutable::now('America/Sao_Paulo')->next('monday')->addWeek();
        $this->actingAsUser($this->owner)->putJson("{$this->base}/instructors/{$this->instructor->getKey()}/weekly-hours", [
            'weekly_hours' => ['1' => [['start' => '08:00', 'end' => '12:00']]],
        ])->assertOk();

        $start = $monday->setTime(14, 0);
        $this->book($enrollment->getKey(), [$start->utc()->toIso8601String(), $start->addHour()->utc()->toIso8601String()])
            ->assertStatus(422)->assertJsonPath('error', 'outside_business_hours');

        $ok = $monday->setTime(9, 0);
        $this->book($enrollment->getKey(), [$ok->utc()->toIso8601String(), $ok->addHour()->utc()->toIso8601String()])->assertCreated();

        $this->actingAsUser($this->owner)->getJson("{$this->base}/instructors/{$this->instructor->getKey()}/availability")
            ->assertOk()->assertJsonPath('data.rule.mode', 'restricted')->assertJsonPath('data.upcoming_count', 1);

        $this->actingAsUser($this->owner)->putJson("{$this->base}/instructors/{$this->instructor->getKey()}/weekly-hours", [
            'weekly_hours' => ['1' => [['start' => '12:00', 'end' => '08:00']]],
        ])->assertUnprocessable();
    }

    public function test_completion_revalidates_vehicle_block_inactive_vehicle_and_expired_crlv(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $enrollment = $this->enrollmentFor($this->org);
        $lessonId = $this->book($enrollment->getKey(), $this->window(3, 9), ['vehicle_id' => $vehicle->getKey()])->assertCreated()->json('data.id');
        $complete = fn () => $this->actingAsUser($this->owner)->patchJson("{$this->base}/lessons/{$lessonId}/status", ['status' => 'completed']);

        // Bloqueio criado depois do agendamento: a aula continua agendada (pré-reserva), mas não pode ser executada.
        $blockId = $this->block(['resource_type' => 'vehicle', 'vehicle_id' => $vehicle->getKey(), 'kind' => 'maintenance', 'reason' => 'Embreagem',
            'starts_at' => now()->addDays(2)->toIso8601String(), 'ends_at' => now()->addDays(5)->toIso8601String()])
            ->assertCreated()->assertJsonCount(1, 'meta.affected')->json('data.id');

        $this->actingAsUser($this->owner)->getJson("{$this->base}/lessons/{$lessonId}")
            ->assertJsonPath('meta.blockers.0.code', 'vehicle_blocked');
        $complete()->assertStatus(409)->assertJsonPath('error', 'vehicle_blocked');

        $this->actingAsUser($this->owner)->postJson("{$this->base}/availability-blocks/{$blockId}/release", ['note' => 'Peça trocada'])->assertOk();
        $complete()->assertOk()->assertJsonPath('data.status', 'completed');
    }

    public function test_completion_is_blocked_by_inactive_vehicle_and_expired_crlv(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $enrollment = $this->enrollmentFor($this->org);
        $lessonId = $this->book($enrollment->getKey(), $this->window(3, 9), ['vehicle_id' => $vehicle->getKey()])->assertCreated()->json('data.id');
        $complete = fn () => $this->actingAsUser($this->owner)->patchJson("{$this->base}/lessons/{$lessonId}/status", ['status' => 'completed']);

        $vehicle->update(['status' => 'inactive']);
        $complete()->assertStatus(409)->assertJsonPath('error', 'vehicle_inactive');

        $vehicle->update(['status' => 'active', 'crlv_expires_at' => now()->subDay()->toDateString()]);
        $complete()->assertStatus(409)->assertJsonPath('error', 'vehicle_document_expired');

        $vehicle->update(['crlv_expires_at' => now()->addYear()->toDateString()]);
        $complete()->assertOk();
    }

    public function test_expired_release_document_blocks_practice_even_if_item_was_verified(): void
    {
        [$process, $enrollment] = $this->processWithEnrollment($this->org, $this->owner);
        $this->releasePractice($process, $this->owner);

        $lessonId = $this->book($enrollment->getKey(), $this->window(3, 9))->assertCreated()->json('data.id');

        $item = $process->checklistItems()->where('required', true)->firstOrFail();
        $document = Document::create([
            'organization_id' => $this->org->getKey(), 'type' => 'other', 'student_id' => $process->student_id, 'qualification_process_id' => $process->getKey(),
            'expires_at' => now()->subDays(2)->toDateString(), 'storage_path' => 'x', 'original_name' => 'x.pdf', 'mime_type' => 'application/pdf', 'size' => 10,
        ]);
        $item->update(['document_id' => $document->getKey()]);

        $this->actingAsUser($this->owner)->patchJson("{$this->base}/lessons/{$lessonId}/status", ['status' => 'completed'])
            ->assertStatus(422)->assertJsonPath('error', 'practice_document_expired');

        $document->update(['expires_at' => now()->addMonth()->toDateString()]);
        $this->actingAsUser($this->owner)->patchJson("{$this->base}/lessons/{$lessonId}/status", ['status' => 'completed'])->assertOk();
    }

    public function test_inactivating_vehicle_or_instructor_link_lists_commitments_without_cancelling(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $enrollment = $this->enrollmentFor($this->org);
        $lessonId = $this->book($enrollment->getKey(), $this->window(3, 9), ['vehicle_id' => $vehicle->getKey()])->assertCreated()->json('data.id');

        $this->actingAsUser($this->owner)->patchJson("{$this->base}/vehicles/{$vehicle->getKey()}", ['status' => 'inactive'])
            ->assertOk()->assertJsonPath('meta.affected.0.id', $lessonId);

        $this->actingAsUser($this->owner)->patchJson("{$this->base}/instructors/{$this->instructor->getKey()}/link", ['active' => false])
            ->assertOk()->assertJsonPath('meta.affected.0.id', $lessonId);

        $this->assertSame(LessonStatus::Scheduled, \App\Models\Lesson::findOrFail($lessonId)->status);

        // Excluir veículo com compromisso futuro exige providência antes.
        $this->actingAsUser($this->owner)->deleteJson("{$this->base}/vehicles/{$vehicle->getKey()}")
            ->assertUnprocessable()->assertJsonPath('error', 'vehicle_has_commitments');
    }

    public function test_crlv_date_change_lists_lessons_after_new_expiry(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $enrollment = $this->enrollmentFor($this->org);
        $lessonId = $this->book($enrollment->getKey(), $this->window(10, 9), ['vehicle_id' => $vehicle->getKey()])->assertCreated()->json('data.id');

        $this->actingAsUser($this->owner)->patchJson("{$this->base}/vehicles/{$vehicle->getKey()}", ['crlv_expires_at' => now()->addDays(5)->toDateString()])
            ->assertOk()->assertJsonPath('meta.affected.0.id', $lessonId);
    }

    public function test_reassign_moves_lesson_to_another_vehicle_respecting_blocks(): void
    {
        $a = $this->vehicleFor($this->org);
        $b = $this->vehicleFor($this->org);
        $c = $this->vehicleFor($this->org);
        $enrollment = $this->enrollmentFor($this->org);
        $lessonId = $this->book($enrollment->getKey(), $this->window(3, 9), ['vehicle_id' => $a->getKey()])->assertCreated()->json('data.id');

        $this->block(['resource_type' => 'vehicle', 'vehicle_id' => $c->getKey(), 'kind' => 'other', 'reason' => 'Lavagem',
            'starts_at' => now()->addDays(2)->toIso8601String(), 'ends_at' => now()->addDays(5)->toIso8601String()])->assertCreated();

        $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons/{$lessonId}/reassign", ['vehicle_id' => $c->getKey()])
            ->assertStatus(409)->assertJsonPath('error', 'vehicle_blocked');

        $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons/{$lessonId}/reassign", ['vehicle_id' => $b->getKey()])
            ->assertOk()->assertJsonPath('data.vehicle.id', $b->getKey());
    }

    public function test_lesson_cannot_overlap_a_scheduled_exam_for_the_same_instructor(): void
    {
        [$process] = $this->processWithEnrollment($this->org, $this->owner);
        [$start] = $this->window(10, 9);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/exams", [
            'qualification_process_id' => $process->getKey(), 'category' => 'B', 'scheduled_at' => $start, 'instructor_id' => $this->instructor->getKey(),
        ])->assertCreated();

        $this->book($this->enrollmentFor($this->org)->getKey(), $this->window(10, 9))->assertStatus(409)->assertJsonPath('error', 'instructor_unavailable');
    }

    public function test_vehicle_overview_gathers_documents_blocks_maintenance_and_affected_commitments(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $enrollment = $this->enrollmentFor($this->org);
        $this->book($enrollment->getKey(), $this->window(3, 9), ['vehicle_id' => $vehicle->getKey()])->assertCreated();
        Document::create([
            'organization_id' => $this->org->getKey(), 'type' => 'vehicle_registration', 'vehicle_id' => $vehicle->getKey(), 'version' => 2,
            'storage_path' => 'x', 'original_name' => 'crlv.pdf', 'mime_type' => 'application/pdf', 'size' => 10,
        ]);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/maintenances", [
            'vehicle_id' => $vehicle->getKey(), 'type' => 'Óleo', 'scheduled_on' => now()->addDays(2)->toDateString(),
            'block' => ['starts_at' => now()->addDays(2)->toIso8601String(), 'ends_at' => now()->addDays(4)->toIso8601String()],
        ])->assertCreated();

        $this->actingAsUser($this->owner)->getJson("{$this->base}/vehicles/{$vehicle->getKey()}/overview")
            ->assertOk()
            ->assertJsonCount(1, 'data.documents')
            ->assertJsonCount(1, 'data.blocks')
            ->assertJsonCount(1, 'data.maintenances')
            ->assertJsonPath('data.commitments.0.issues.0', 'blocked')
            ->assertJsonPath('data.affected_count', 1);

        // Instrutores não consultam custos e documentos.
        $instructorUser = User::factory()->create();
        $this->addMember($this->org, $instructorUser, MembershipRole::Instructor);
        $this->actingAsUser($instructorUser)->getJson("{$this->base}/vehicles/{$vehicle->getKey()}/overview")->assertForbidden();
        $this->actingAsUser($instructorUser)->getJson("{$this->base}/maintenances")->assertForbidden();
    }

    public function test_next_revision_alerts_by_date_and_by_known_odometer(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $create = fn (array $extra) => $this->actingAsUser($this->owner)->postJson("{$this->base}/maintenances", $extra + [
            'vehicle_id' => $vehicle->getKey(), 'type' => 'Revisão', 'scheduled_on' => now()->toDateString(),
        ])->assertCreated()->json('data.id');
        $complete = fn (int $id, array $extra) => $this->actingAsUser($this->owner)->postJson("{$this->base}/maintenances/{$id}/complete", $extra)->assertOk();

        $first = $create([]);
        $complete($first, ['odometer_km' => 59500, 'next_due_km' => 60000, 'next_due_date' => now()->addMonths(6)->toDateString()]);

        $this->actingAsUser($this->owner)->getJson("{$this->base}/vehicles/{$vehicle->getKey()}/overview")
            ->assertJsonPath('data.maintenance_due.0.state', 'due_soon')
            ->assertJsonPath('data.maintenance_due.0.reasons.0', 'km');

        // Nova revisão do mesmo tipo substitui a anterior como referência.
        $second = $create([]);
        $complete($second, ['odometer_km' => 60100, 'next_due_km' => 70000]);
        $this->actingAsUser($this->owner)->getJson("{$this->base}/vehicles/{$vehicle->getKey()}/overview")
            ->assertJsonCount(0, 'data.maintenance_due');
    }

    public function test_closed_maintenance_cannot_be_changed_and_cancel_releases_block(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $id = $this->actingAsUser($this->owner)->postJson("{$this->base}/maintenances", [
            'vehicle_id' => $vehicle->getKey(), 'type' => 'Pneus', 'scheduled_on' => now()->addDay()->toDateString(),
            'block' => ['starts_at' => now()->addDay()->toIso8601String(), 'ends_at' => now()->addDays(2)->toIso8601String()],
        ])->assertCreated()->json('data.id');

        $this->actingAsUser($this->owner)->postJson("{$this->base}/maintenances/{$id}/cancel", ['reason' => 'Adiada'])
            ->assertOk()->assertJsonPath('data.status', 'cancelled')->assertJsonPath('data.block.status', 'released');
        $this->actingAsUser($this->owner)->patchJson("{$this->base}/maintenances/{$id}", ['type' => 'Outro'])->assertUnprocessable();
        $this->actingAsUser($this->owner)->postJson("{$this->base}/maintenances/{$id}/complete", [])->assertUnprocessable();
    }

    public function test_blocks_are_isolated_between_organizations(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $other = $this->organizationWithOwner();

        $this->actingAsUser($other->members()->first())
            ->postJson($this->prefix."/organizations/{$other->getKey()}/availability-blocks", [
                'resource_type' => 'vehicle', 'vehicle_id' => $vehicle->getKey(), 'kind' => 'other', 'reason' => 'Intruso',
                'starts_at' => now()->addDay()->toIso8601String(), 'ends_at' => now()->addDays(2)->toIso8601String(),
            ])->assertUnprocessable()->assertJsonValidationErrors('vehicle_id');
    }

    /**
     * Janela de um dia futuro no fuso do espaço (America/Sao_Paulo), em UTC.
     *
     * @return array{0: string, 1: string}
     */
    private function localWindow(int $daysAhead, string $from, string $to): array
    {
        $day = CarbonImmutable::now('America/Sao_Paulo')->addDays($daysAhead)->startOfDay();
        // Garante um dia útil (segunda a sexta) para as regras de horário comercial.
        while ($day->isoWeekday() > 5) {
            $day = $day->addDay();
        }

        return [
            $day->setTimeFromTimeString($from)->utc()->toIso8601String(),
            $day->setTimeFromTimeString($to)->utc()->toIso8601String(),
        ];
    }
}
