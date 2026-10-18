<?php

namespace Tests\Feature\Api;

use App\Enums\LicenseCategory;
use App\Enums\MembershipRole;
use App\Models\CreditEntry;
use App\Models\Enrollment;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\Student;
use App\Models\User;

/**
 * Módulo 1 — pacotes e saldo de aulas: contratação, reserva, consumo, políticas, estorno e isolamento.
 */
class CreditBalanceTest extends ApiTestCase
{
    private User $owner;

    private Organization $org;

    private Instructor $instructor;

    private Enrollment $enrollment;

    private string $base;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->org = $this->organizationWithOwner('cfc', $this->owner);
        $this->instructor = $this->linkInstructor($this->org);
        $this->enrollment = $this->enrollmentFor($this->org);
        $this->base = $this->prefix."/organizations/{$this->org->getKey()}";
    }

    private function contract(int $minutes = 500, array $extra = [], ?Enrollment $enrollment = null)
    {
        $enrollment ??= $this->enrollment;

        return $this->actingAsUser($this->owner)->postJson("{$this->base}/enrollments/{$enrollment->getKey()}/packages", $extra + [
            'description' => 'Pacote de aulas',
            'minutes' => $minutes,
        ]);
    }

    private function balance(?Enrollment $enrollment = null): array
    {
        $enrollment ??= $this->enrollment;

        return $this->actingAsUser($this->owner)
            ->getJson("{$this->base}/enrollments/{$enrollment->getKey()}/balance")->assertOk()->json('data');
    }

    private function schedule(int $minutes = 100, int $hour = 9, array $extra = [], ?Enrollment $enrollment = null)
    {
        [$start, $end] = $this->window(3, $hour, $minutes);

        return $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons", $extra + [
            'enrollment_id' => ($enrollment ?? $this->enrollment)->getKey(),
            'instructor_id' => $this->instructor->getKey(),
            'starts_at' => $start,
            'ends_at' => $end,
        ]);
    }

    private function setStatus(int $lessonId, array $data)
    {
        return $this->actingAsUser($this->owner)->patchJson("{$this->base}/lessons/{$lessonId}/status", $data);
    }

    public function test_acceptance_500_contracted_100_reserved_then_50_realized_explains_every_part(): void
    {
        $this->contract(500, ['reference_minutes' => 50])->assertCreated();
        $lessonId = $this->schedule(100)->assertCreated()->json('data.id');

        $b = $this->balance();
        $this->assertSame([500, 100, 0, 0, 400], [$b['contracted'], $b['reserved'], $b['realized'], $b['consumed'], $b['available']]);
        $this->assertEquals(8, $b['equivalent_lessons']);

        $this->setStatus($lessonId, ['status' => 'completed', 'actual_minutes' => 50])->assertOk();

        $b = $this->balance();
        $this->assertSame([500, 0, 50, 50, 450], [$b['contracted'], $b['reserved'], $b['realized'], $b['consumed'], $b['available']]);

        // Recarregar ou repetir a requisição não muda o resultado.
        $this->setStatus($lessonId, ['status' => 'completed', 'actual_minutes' => 50])->assertStatus(422);
        $this->assertSame($b['available'], $this->balance()['available']);
        $this->assertSame(1, CreditEntry::query()->where('lesson_id', $lessonId)->where('type', 'consume')->count());
    }

    public function test_equivalence_in_lessons_only_with_explicit_reference_duration(): void
    {
        $this->contract(500)->assertCreated();

        $this->assertNull($this->balance()['equivalent_lessons']);
    }

    public function test_cancellation_releases_the_reservation(): void
    {
        $this->contract(300)->assertCreated();
        $id = $this->schedule(60)->assertCreated()->json('data.id');
        $this->assertSame(60, $this->balance()['reserved']);

        $this->setStatus($id, ['status' => 'cancelled', 'reason' => 'Aluno desistiu da data'])->assertOk();

        $b = $this->balance();
        $this->assertSame([0, 0, 300], [$b['reserved'], $b['consumed'], $b['available']]);
    }

    public function test_reschedule_moves_the_reservation_without_duplicating_it(): void
    {
        $this->contract(300)->assertCreated();
        $id = $this->schedule(60)->assertCreated()->json('data.id');

        [$start, $end] = $this->window(5, 10, 90);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons/{$id}/reschedule", ['starts_at' => $start, 'ends_at' => $end])->assertOk();

        $this->assertSame(90, $this->balance()['reserved']);

        [$start, $end] = $this->window(6, 10, 90);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons/{$id}/reschedule", ['starts_at' => $start, 'ends_at' => $end])->assertOk();
        $this->assertSame(90, $this->balance()['reserved']);
    }

    public function test_charged_absence_consumes_credit_without_adding_realized_minutes(): void
    {
        $this->contract(300, ['absence_charge' => 'full'])->assertCreated();
        $id = $this->schedule(60)->assertCreated()->json('data.id');

        $this->setStatus($id, ['status' => 'missed', 'reason' => 'Faltou sem aviso'])->assertOk();

        $b = $this->balance();
        $this->assertSame([0, 0, 60, 240], [$b['reserved'], $b['realized'], $b['consumed'], $b['available']]);
    }

    public function test_absence_without_charge_policy_consumes_nothing(): void
    {
        $this->contract(300)->assertCreated();
        $id = $this->schedule(60)->assertCreated()->json('data.id');

        $this->setStatus($id, ['status' => 'missed'])->assertOk();

        $this->assertSame(300, $this->balance()['available']);
    }

    public function test_late_cancellation_is_charged_only_inside_the_notice_window(): void
    {
        $this->contract(300, ['late_cancel_charge' => 'full', 'cancel_notice_hours' => 24 * 10])->assertCreated();
        $id = $this->schedule(60)->assertCreated()->json('data.id');

        $this->setStatus($id, ['status' => 'cancelled', 'reason' => 'Cancelou em cima da hora'])->assertOk();

        $this->assertSame(60, $this->balance()['consumed']);

        $this->contract(300, ['late_cancel_charge' => 'full', 'cancel_notice_hours' => 1])->assertCreated();
        $other = $this->schedule(60, 11)->assertCreated()->json('data.id');
        $this->setStatus($other, ['status' => 'cancelled'])->assertOk();

        $this->assertSame(60, $this->balance()['consumed']);
    }

    public function test_scheduled_basis_consumes_the_scheduled_time_even_if_actual_is_shorter(): void
    {
        $this->contract(300, ['consume_basis' => 'scheduled'])->assertCreated();
        $id = $this->schedule(60)->assertCreated()->json('data.id');

        $this->setStatus($id, ['status' => 'completed', 'actual_minutes' => 40])->assertOk();

        $b = $this->balance();
        $this->assertSame([40, 60], [$b['realized'], $b['consumed']]);
    }

    public function test_duration_adjustment_records_only_the_difference(): void
    {
        $this->contract(300)->assertCreated();
        $id = $this->schedule(60)->assertCreated()->json('data.id');
        $this->setStatus($id, ['status' => 'completed', 'actual_minutes' => 60])->assertOk();

        $this->actingAsUser($this->owner)->patchJson("{$this->base}/lessons/{$id}", ['actual_minutes' => 45])->assertOk();

        $b = $this->balance();
        $this->assertSame([45, 45, 255], [$b['realized'], $b['consumed'], $b['available']]);
        $adjust = CreditEntry::query()->where('type', 'consume_adjustment')->firstOrFail();
        $this->assertSame(-15, $adjust->minutes);
        $this->assertSame(1, CreditEntry::query()->where('type', 'consume')->count());
        $this->assertSame(60, CreditEntry::query()->where('type', 'consume')->value('minutes'));
    }

    public function test_insufficient_balance_blocks_unless_authorized_with_reason(): void
    {
        $this->contract(60)->assertCreated();

        $this->schedule(90)->assertStatus(422)->assertJsonPath('error', 'insufficient_balance');

        $this->schedule(90, 9, ['override_reason' => 'Aluno pagará o acréscimo amanhã'])
            ->assertCreated()
            ->assertJsonPath('warnings.0.code', 'insufficient_balance_override');

        $this->assertSame(-30, $this->balance()['available']);
        $this->assertDatabaseHas('audit_events', ['event' => 'balance.override']);
    }

    public function test_enrollment_without_package_schedules_as_standalone_lesson_with_warning(): void
    {
        $this->schedule(60)->assertCreated()->assertJsonPath('warnings.0.code', 'no_package');
    }

    public function test_adjustment_requires_reason_admin_and_never_goes_negative(): void
    {
        $this->contract(100)->assertCreated();
        $path = "{$this->base}/enrollments/{$this->enrollment->getKey()}/credit-adjustments";

        $this->actingAsUser($this->owner)->postJson($path, ['minutes' => 30])->assertStatus(422);
        $this->actingAsUser($this->owner)->postJson($path, ['minutes' => -500, 'reason' => 'Erro de digitação'])
            ->assertStatus(422)->assertJsonPath('error', 'adjustment_exceeds_balance');
        $this->actingAsUser($this->owner)->postJson($path, ['minutes' => -20, 'reason' => 'Erro de digitação'])->assertCreated();

        $this->assertSame(80, $this->balance()['available']);

        $staff = User::factory()->create();
        $this->addMember($this->org, $staff, MembershipRole::Staff);
        $this->actingAsUser($staff)->postJson($path, ['minutes' => 10, 'reason' => 'Tentativa'])->assertForbidden();
    }

    public function test_reversal_creates_compensating_entry_preserving_the_original(): void
    {
        $this->contract(100)->assertCreated();
        $id = $this->schedule(50)->assertCreated()->json('data.id');
        $this->setStatus($id, ['status' => 'completed'])->assertOk();
        $entry = CreditEntry::query()->where('type', 'consume')->firstOrFail();

        $path = "{$this->base}/enrollments/{$this->enrollment->getKey()}/credit-entries/{$entry->getKey()}/reversal";
        $this->actingAsUser($this->owner)->postJson($path, ['reason' => 'Aula registrada por engano'])->assertCreated();

        $b = $this->balance();
        $this->assertSame([0, 100], [$b['consumed'], $b['available']]);
        $this->assertDatabaseHas('enrollment_credit_entries', ['id' => $entry->getKey(), 'minutes' => 50]);
        $this->assertDatabaseHas('enrollment_credit_entries', ['reverses_entry_id' => $entry->getKey(), 'minutes' => -50]);

        $this->actingAsUser($this->owner)->postJson($path, ['reason' => 'Outra vez'])->assertStatus(409);
    }

    public function test_statement_lists_movements_with_author_and_reason(): void
    {
        $this->contract(100)->assertCreated();
        $this->schedule(50)->assertCreated();

        $rows = $this->actingAsUser($this->owner)
            ->getJson("{$this->base}/enrollments/{$this->enrollment->getKey()}/credit-entries")
            ->assertOk()->json('data');

        $this->assertCount(2, $rows);
        $this->assertSame($this->owner->name, $rows[0]['actor']['name']);
        $this->assertSame('reserve', $rows[0]['bucket']);
    }

    public function test_ab_enrollment_tracks_each_category_separately(): void
    {
        $student = Student::factory()->for($this->org)->create();
        $ab = Enrollment::create([
            'organization_id' => $this->org->getKey(), 'student_id' => $student->getKey(), 'category' => LicenseCategory::AB,
        ]);

        $this->contract(100, ['category' => 'A'], $ab)->assertCreated();
        $this->contract(200, ['category' => 'B'], $ab)->assertCreated();
        $this->contract(50, [], $ab)->assertCreated(); // saldo sem categoria = a distribuir

        $b = $this->balance($ab);
        $this->assertSame(350, $b['contracted']);
        $a = collect($b['by_category'])->firstWhere('category', 'A');
        $this->assertSame(100, $a['available']);

        $this->instructor->update(['categories' => ['A', 'B']]);
        $vehicle = $this->vehicleFor($this->org, LicenseCategory::A);
        $this->schedule(60, 9, ['vehicle_id' => $vehicle->getKey()], $ab)->assertCreated();

        $b = $this->balance($ab);
        $this->assertSame(60, collect($b['by_category'])->firstWhere('category', 'A')['reserved']);
        $this->assertSame(0, collect($b['by_category'])->firstWhere('category', 'B')['reserved']);

        // Categoria A só tem 40 min livres: 90 min de A são bloqueados mesmo havendo crédito em B.
        $this->schedule(90, 12, ['vehicle_id' => $vehicle->getKey()], $ab)->assertStatus(422)->assertJsonPath('error', 'insufficient_balance');
    }

    public function test_enrollment_creation_with_minutes_generates_the_first_package(): void
    {
        $student = Student::factory()->for($this->org)->create();

        $id = $this->actingAsUser($this->owner)->postJson("{$this->base}/enrollments", [
            'student_id' => $student->getKey(), 'category' => 'B', 'contracted_minutes' => 600, 'price_cents' => 90000,
        ])->assertCreated()->assertJsonPath('data.contracted_minutes', 600)->assertJsonPath('data.balance.available', 600)->json('data.id');

        $this->assertDatabaseHas('enrollment_packages', ['enrollment_id' => $id, 'minutes' => 600, 'price_cents' => 90000]);
    }

    public function test_contract_data_cannot_be_silently_edited_and_category_locks_after_use(): void
    {
        $this->contract(100)->assertCreated();
        $path = "{$this->base}/enrollments/{$this->enrollment->getKey()}";

        $this->actingAsUser($this->owner)->patchJson($path, ['contracted_minutes' => 999])->assertStatus(422);
        $this->actingAsUser($this->owner)->patchJson($path, ['category' => 'A'])
            ->assertStatus(422)->assertJsonPath('error', 'enrollment_category_locked');
        $this->actingAsUser($this->owner)->patchJson($path, ['status' => 'in_service'])->assertOk();
        $this->assertDatabaseHas('audit_events', ['event' => 'enrollment.updated', 'enrollment_id' => $this->enrollment->getKey()]);
    }

    public function test_migration_backfill_reconciles_legacy_minutes_without_duplicating(): void
    {
        $legacy = $this->enrollmentFor($this->org);
        $legacy->update(['contracted_minutes' => 600]);
        $this->assertSame(600, $this->actingAsUser($this->owner)
            ->getJson("{$this->base}/enrollments/{$legacy->getKey()}")->json('data.contracted_minutes'));

        $before = CreditEntry::query()->count();
        $migration = require database_path('migrations/2026_10_17_500005_backfill_enrollment_credits.php');
        $migration->up();

        $this->assertSame(1, CreditEntry::query()->where('enrollment_id', $legacy->getKey())->where('type', 'initial_balance')->count());
        $this->assertGreaterThan($before, CreditEntry::query()->count());
    }

    public function test_instructor_does_not_see_balance_and_other_space_cannot_access(): void
    {
        $this->contract(100)->assertCreated();

        $instructorUser = User::factory()->create();
        $this->addMember($this->org, $instructorUser, MembershipRole::Instructor);
        $this->actingAsUser($instructorUser)->getJson("{$this->base}/enrollments/{$this->enrollment->getKey()}/balance")->assertForbidden();

        $outsider = User::factory()->create();
        $otherOrg = $this->organizationWithOwner('cfc', $outsider);
        $this->actingAsUser($outsider)
            ->getJson($this->prefix."/organizations/{$otherOrg->getKey()}/enrollments/{$this->enrollment->getKey()}/balance")
            ->assertNotFound();
        $this->actingAsUser($outsider)->getJson("{$this->base}/enrollments/{$this->enrollment->getKey()}/balance")->assertNotFound();
    }

    public function test_concurrent_completion_never_double_consumes(): void
    {
        // O modelo de lock + chave de deduplicação protege a segunda tentativa mesmo se o status for forçado de volta.
        $this->contract(100)->assertCreated();
        $id = $this->schedule(50)->assertCreated()->json('data.id');
        $this->setStatus($id, ['status' => 'completed'])->assertOk();

        \App\Models\Lesson::query()->whereKey($id)->update(['status' => 'scheduled']);
        $this->setStatus($id, ['status' => 'completed'])->assertOk();

        $this->assertSame(1, CreditEntry::query()->where('lesson_id', $id)->where('type', 'consume')->count());
        $this->assertSame(50, $this->balance()['consumed']);
    }
}
