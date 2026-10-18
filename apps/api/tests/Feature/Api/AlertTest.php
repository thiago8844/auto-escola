<?php

namespace Tests\Feature\Api;

use App\Enums\LicenseCategory;
use App\Enums\MembershipRole;
use App\Jobs\GenerateOrganizationAlerts;
use App\Models\Alert;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\User;
use App\Services\AlertEngine;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Queue;

/**
 * Módulo 5 — pendências e alertas reais.
 */
class AlertTest extends ApiTestCase
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

    private function refresh(?User $as = null)
    {
        return $this->actingAsUser($as ?? $this->owner)->postJson("{$this->base}/alerts/refresh");
    }

    private function alerts(?User $as = null, string $query = '')
    {
        return $this->actingAsUser($as ?? $this->owner)->getJson("{$this->base}/alerts{$query}");
    }

    public function test_aceite_real_pending_shows_after_new_login_opens_correct_record_and_resolves_without_repeating(): void
    {
        $vehicle = $this->vehicleFor($this->org, overrides: ['plate' => 'ABC1D23', 'crlv_expires_at' => now()->addDays(10)->toDateString()]);

        $this->refresh()->assertOk()->assertJsonPath('data.created', 1);
        // Nova rodada com a pendência igual: nada de repetido.
        $this->refresh()->assertOk()->assertJsonPath('data.created', 0)->assertJsonPath('data.updated', 0);

        // "Novo login": estado só no servidor, outro cliente vê o mesmo.
        app('auth')->forgetGuards();
        $list = $this->alerts()->assertOk();
        $list->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.kind', 'vehicle.crlv_expiring')
            ->assertJsonPath('data.0.subject.type', 'vehicle')
            ->assertJsonPath('data.0.subject.id', $vehicle->getKey())
            ->assertJsonPath('data.0.read_at', null)
            ->assertJsonPath('meta.unread', 1);

        $id = $list->json('data.0.id');
        $this->actingAsUser($this->owner)->postJson("{$this->base}/alerts/{$id}/read")->assertOk()->assertJsonPath('data.unread', 0);

        // Resolver a pendência: renova o CRLV.
        $vehicle->update(['crlv_expires_at' => now()->addYear()->toDateString()]);
        $this->refresh()->assertOk()->assertJsonPath('data.resolved', 1)->assertJsonPath('data.created', 0);

        $this->alerts()->assertJsonCount(0, 'data');
        $this->alerts(null, '?status=resolved')->assertJsonCount(1, 'data')->assertJsonPath('data.0.resolved_reason', 'Pendência resolvida');
        $this->assertSame(1, Alert::count());
    }

    public function test_deadline_change_replaces_the_alert_and_expired_crlv_with_commitments_is_critical(): void
    {
        $vehicle = $this->vehicleFor($this->org, overrides: ['crlv_expires_at' => now()->addDays(20)->toDateString()]);
        $this->refresh();
        $this->assertSame('normal', Alert::firstOrFail()->priority);

        // Prazo muda para antes de uma aula já agendada: novo alerta, crítico; o antigo é resolvido.
        $enrollment = $this->enrollmentFor($this->org);
        $window = $this->window(15, 9);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons", [
            'enrollment_id' => $enrollment->getKey(), 'instructor_id' => $this->instructor->getKey(), 'vehicle_id' => $vehicle->getKey(),
            'starts_at' => $window[0], 'ends_at' => $window[1],
        ])->assertCreated();
        $vehicle->update(['crlv_expires_at' => now()->addDays(5)->toDateString()]);

        $this->refresh()->assertJsonPath('data.created', 1)->assertJsonPath('data.resolved', 1);
        $this->alerts()->assertJsonCount(1, 'data')->assertJsonPath('data.0.priority', 'critical');
        $this->assertSame(2, Alert::count());
    }

    public function test_block_with_commitments_exam_results_and_released_resource(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $enrollment = $this->enrollmentFor($this->org);
        $window = $this->window(3, 9);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons", [
            'enrollment_id' => $enrollment->getKey(), 'instructor_id' => $this->instructor->getKey(), 'vehicle_id' => $vehicle->getKey(),
            'starts_at' => $window[0], 'ends_at' => $window[1],
        ])->assertCreated();
        $blockId = $this->actingAsUser($this->owner)->postJson("{$this->base}/availability-blocks", [
            'resource_type' => 'vehicle', 'vehicle_id' => $vehicle->getKey(), 'kind' => 'maintenance', 'reason' => 'Freio',
            'starts_at' => now()->addDays(2)->toIso8601String(), 'ends_at' => now()->addDays(5)->toIso8601String(),
        ])->assertCreated()->json('data.id');

        $this->refresh();
        $this->assertDatabaseHas('alerts', ['dedup_key' => "block:{$blockId}:affected", 'status' => 'open']);

        $this->actingAsUser($this->owner)->postJson("{$this->base}/availability-blocks/{$blockId}/release")->assertOk();
        $this->refresh()->assertJsonPath('data.resolved', 1);
        $this->assertDatabaseHas('alerts', ['dedup_key' => "block:{$blockId}:affected", 'status' => 'resolved']);
    }

    public function test_exam_alerts_missing_result_and_pending_fee(): void
    {
        [$process] = $this->processWithEnrollment($this->org, $this->owner);

        $past = $this->actingAsUser($this->owner)->postJson("{$this->base}/exams", [
            'qualification_process_id' => $process->getKey(), 'category' => 'B', 'scheduled_at' => now()->addMinutes(5)->toIso8601String(),
        ])->assertCreated()->json('data.id');
        \App\Models\PracticalExam::whereKey($past)->update(['scheduled_at' => now()->subDays(2)]);

        $this->actingAsUser($this->owner)->postJson("{$this->base}/external-fees", [
            'qualification_process_id' => $process->getKey(), 'kind' => 'Taxa do exame prático', 'due_date' => now()->subDay()->toDateString(),
        ])->assertCreated();

        $this->refresh();
        $kinds = Alert::pluck('kind')->all();
        $this->assertContains('exam.result_missing', $kinds);
        $this->assertContains('fee.overdue', $kinds);

        // Registrar o resultado resolve o alerta do exame.
        $this->actingAsUser($this->owner)->postJson("{$this->base}/exams/{$past}/result", ['status' => 'failed', 'reason' => 'Reprovado'])->assertOk();
        $this->refresh();
        $this->assertDatabaseHas('alerts', ['kind' => 'exam.result_missing', 'status' => 'resolved']);
    }

    public function test_low_and_exhausted_balance_lessons_without_outcome_and_inactive_students(): void
    {
        $enrollment = $this->enrollmentFor($this->org);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/enrollments/{$enrollment->getKey()}/packages", ['description' => 'Pacote', 'minutes' => 150])->assertCreated();
        $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons", [
            'enrollment_id' => $enrollment->getKey(), 'instructor_id' => $this->instructor->getKey(),
            'starts_at' => $this->window(1, 9)[0], 'ends_at' => $this->window(1, 9, 60)[1],
        ])->assertCreated();

        // 150 - 60 reservados = 90 min (abaixo do limite de 100).
        $this->refresh();
        $this->assertDatabaseHas('alerts', ['kind' => 'balance.low', 'status' => 'open']);

        // A aula passa sem desfecho.
        \App\Models\Lesson::query()->update(['starts_at' => now()->subDays(3), 'ends_at' => now()->subDays(3)->addHour()]);
        $this->refresh();
        $this->assertDatabaseHas('alerts', ['kind' => 'lesson.no_outcome', 'status' => 'open', 'audience' => 'both', 'instructor_id' => $this->instructor->getKey()]);

        // Marcar como realizada resolve.
        $lessonId = \App\Models\Lesson::firstOrFail()->getKey();
        $this->actingAsUser($this->owner)->patchJson("{$this->base}/lessons/{$lessonId}/status", ['status' => 'missed', 'reason' => 'Faltou'])->assertOk();
        $this->refresh();
        $this->assertDatabaseHas('alerts', ['kind' => 'lesson.no_outcome', 'status' => 'resolved']);
    }

    public function test_release_pending_for_upcoming_lesson(): void
    {
        [$process, $enrollment] = $this->processWithEnrollment($this->org, $this->owner);
        $window = $this->window(2, 9);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons", [
            'enrollment_id' => $enrollment->getKey(), 'instructor_id' => $this->instructor->getKey(), 'starts_at' => $window[0], 'ends_at' => $window[1],
        ])->assertCreated();

        $this->refresh();
        $this->assertDatabaseHas('alerts', ['kind' => 'lesson.release_pending', 'status' => 'open']);

        $this->releasePractice($process, $this->owner);
        $this->refresh();
        $this->assertDatabaseHas('alerts', ['kind' => 'lesson.release_pending', 'status' => 'resolved']);
    }

    public function test_read_archive_and_read_all_are_per_user_and_persistent(): void
    {
        $this->vehicleFor($this->org, overrides: ['crlv_expires_at' => now()->addDays(3)->toDateString()]);
        $this->vehicleFor($this->org, overrides: ['crlv_expires_at' => now()->addDays(4)->toDateString()]);
        $admin = User::factory()->create();
        $this->addMember($this->org, $admin, MembershipRole::Admin);
        $this->refresh();

        $ids = collect($this->alerts()->json('data'))->pluck('id');
        $this->assertCount(2, $ids);

        $this->actingAsUser($this->owner)->postJson("{$this->base}/alerts/{$ids[0]}/archive")->assertOk();
        $this->alerts()->assertJsonCount(1, 'data');
        $this->alerts(null, '?archived=1')->assertJsonCount(1, 'data');
        // O outro usuário não é afetado.
        $this->alerts($admin)->assertJsonCount(2, 'data')->assertJsonPath('meta.unread', 2);

        $this->actingAsUser($admin)->postJson("{$this->base}/alerts/read-all")->assertOk()->assertJsonPath('data.unread', 0);
        $this->alerts()->assertJsonPath('meta.unread', 1);
        $this->alerts($admin, '?unread=1')->assertJsonCount(0, 'data');

        $this->actingAsUser($this->owner)->postJson("{$this->base}/alerts/{$ids[0]}/unarchive")->assertOk();
        $this->alerts()->assertJsonCount(2, 'data');
    }

    public function test_recipients_and_scope_instructor_sees_only_own_and_revoked_access_loses_everything(): void
    {
        $instructorUser = User::factory()->create();
        $mine = Instructor::factory()->create(['user_id' => $instructorUser->getKey()]);
        $this->org->instructors()->attach($mine->getKey(), ['active' => true]);
        $this->addMember($this->org, $instructorUser, MembershipRole::Instructor);
        $staff = User::factory()->create();
        $this->addMember($this->org, $staff, MembershipRole::Staff);

        $this->vehicleFor($this->org, overrides: ['crlv_expires_at' => now()->addDays(3)->toDateString()]);
        $enrollment = $this->enrollmentFor($this->org);
        $this->lessonFor($this->org, $mine, $enrollment, now()->subDays(2)->toIso8601String(), now()->subDays(2)->addHour()->toIso8601String());
        $this->lessonFor($this->org, $this->instructor, $this->enrollmentFor($this->org), now()->subDays(2)->toIso8601String(), now()->subDays(2)->addHour()->toIso8601String());
        $this->refresh();

        // O instrutor vê só a aula dele; nada de veículo, saldo ou colegas.
        $mineList = $this->alerts($instructorUser)->assertOk();
        $mineList->assertJsonCount(1, 'data')->assertJsonPath('data.0.kind', 'lesson.no_outcome');

        // A equipe vê os operacionais por padrão; configurável.
        $this->alerts($staff)->assertJsonCount(3, 'data');
        $this->actingAsUser($this->owner)->patchJson("{$this->base}/alert-settings", ['staff_receives' => false])->assertOk();
        $this->alerts($staff)->assertJsonCount(0, 'data');
        $this->actingAsUser($staff)->patchJson("{$this->base}/alert-settings", ['staff_receives' => true])->assertForbidden();

        // Instrutor não consegue marcar alerta de outro.
        $other = Alert::where('kind', 'vehicle.crlv_expiring')->firstOrFail();
        $this->actingAsUser($instructorUser)->postJson("{$this->base}/alerts/{$other->getKey()}/read")->assertNotFound();

        // Acesso revogado: a rota inteira some.
        $this->org->members()->detach($instructorUser->getKey());
        $this->org->forgetRoleCache();
        $this->alerts($instructorUser)->assertNotFound();
    }

    public function test_alerts_are_isolated_between_organizations(): void
    {
        $this->vehicleFor($this->org, overrides: ['crlv_expires_at' => now()->addDays(3)->toDateString()]);
        $other = $this->organizationWithOwner();
        $this->refresh();

        $this->actingAsUser($other->members()->first())->getJson($this->prefix."/organizations/{$other->getKey()}/alerts")
            ->assertOk()->assertJsonCount(0, 'data');
        $this->actingAsUser($other->members()->first())->getJson("{$this->base}/alerts")->assertNotFound();
    }

    public function test_scheduler_command_fans_out_jobs_and_runs_now(): void
    {
        $this->vehicleFor($this->org, overrides: ['crlv_expires_at' => now()->addDays(3)->toDateString()]);

        Queue::fake();
        $this->artisan('alerts:generate')->assertSuccessful();
        Queue::assertPushed(GenerateOrganizationAlerts::class, fn ($job) => $job->organizationId === $this->org->getKey());

        $this->artisan('alerts:generate', ['--organization' => $this->org->getKey(), '--now' => true])->assertSuccessful();
        $this->assertSame(1, Alert::count());

        (new GenerateOrganizationAlerts($this->org->getKey()))->handle(app(AlertEngine::class));
        $this->assertSame(1, Alert::count());

        $this->assertTrue(collect(app(\Illuminate\Console\Scheduling\Schedule::class)->events())->contains(fn ($e) => str_contains($e->command, 'alerts:generate')));
    }

    public function test_settings_change_the_lead_time(): void
    {
        $this->vehicleFor($this->org, overrides: ['crlv_expires_at' => now()->addDays(20)->toDateString()]);
        $this->actingAsUser($this->owner)->patchJson("{$this->base}/alert-settings", ['crlv_lead_days' => 10])
            ->assertOk()->assertJsonPath('data.crlv_lead_days', 10);
        $this->refresh()->assertJsonPath('data.created', 0);

        $this->actingAsUser($this->owner)->patchJson("{$this->base}/alert-settings", ['crlv_lead_days' => 30])->assertOk();
        $this->refresh()->assertJsonPath('data.created', 1);

        $this->actingAsUser($this->owner)->patchJson("{$this->base}/alert-settings", ['crlv_lead_days' => 0])->assertUnprocessable();
    }

    public function test_reopened_pending_returns_unread(): void
    {
        $vehicle = $this->vehicleFor($this->org, overrides: ['crlv_expires_at' => now()->addDays(3)->toDateString()]);
        $this->refresh();
        $id = Alert::firstOrFail()->getKey();
        $this->actingAsUser($this->owner)->postJson("{$this->base}/alerts/{$id}/read")->assertOk();

        $original = $vehicle->crlv_expires_at->toDateString();
        $vehicle->update(['crlv_expires_at' => now()->addYear()->toDateString()]);
        $this->refresh();
        $vehicle->update(['crlv_expires_at' => $original]);
        $this->refresh()->assertJsonPath('data.created', 0);

        $this->alerts()->assertJsonPath('data.0.read_at', null)->assertJsonPath('meta.unread', 1);
    }
}
