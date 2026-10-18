<?php

namespace Tests\Feature\Api;

use App\Enums\LessonStatus;
use App\Enums\MembershipRole;
use App\Models\Enrollment;
use App\Models\Instructor;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\PracticalExam;
use App\Models\Student;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Módulo 7 — relatórios e painel de gestão.
 */
class ReportTest extends ApiTestCase
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

    private function report(string $path, string $query = '', ?User $as = null)
    {
        return $this->actingAsUser($as ?? $this->owner)->getJson("{$this->base}/reports/{$path}".($query ? "?{$query}" : ''));
    }

    /** Aula no fuso do espaço (America/Sao_Paulo): dia D às HH:MM, duração em minutos. */
    private function lesson(Enrollment $e, string $day, string $time, LessonStatus $status = LessonStatus::Completed, int $minutes = 60, array $extra = []): Lesson
    {
        $start = CarbonImmutable::parse("{$day} {$time}", 'America/Sao_Paulo')->utc();

        return Lesson::create(array_merge([
            'organization_id' => $this->org->getKey(), 'enrollment_id' => $e->getKey(), 'instructor_id' => $this->instructor->getKey(),
            'starts_at' => $start, 'ends_at' => $start->addMinutes($minutes), 'status' => $status,
        ], $extra));
    }

    public function test_aceite_indicator_drilldown_and_export_have_the_same_totals(): void
    {
        $enrollment = $this->enrollmentFor($this->org);
        $day = now('America/Sao_Paulo')->subDays(5)->toDateString();

        // 130 aulas realizadas de 50 min (acima de duas páginas de 100) + faltas e cancelamentos.
        foreach (range(1, 130) as $i) {
            $this->lesson($enrollment, $day, '08:00', LessonStatus::Completed, 50, ['actual_minutes' => $i % 2 === 0 ? 45 : null, 'registry_status' => $i % 5 === 0 ? 'confirmed' : 'not_informed']);
        }
        $this->lesson($enrollment, $day, '10:00', LessonStatus::Missed);
        $this->lesson($enrollment, $day, '11:00', LessonStatus::Cancelled);

        $summary = $this->report('lessons', "from={$day}&to={$day}")->assertOk();
        $totals = $summary->json('data.totals');
        $this->assertSame(132, $totals['count']);
        $this->assertSame(130 * 50 + 120, $totals['scheduled_minutes']);
        $this->assertSame(65 * 45 + 65 * 50, $totals['actual_minutes']);
        // Confirmadas: múltiplos de 5 (26 aulas); pares valem 45 min e ímpares 50 min.
        $this->assertSame(13 * 45 + 13 * 50, $totals['confirmed_minutes']);

        // Detalhe: várias páginas, mesmo total e soma que fecha com o indicador.
        $sum = 0;
        $rows = 0;
        foreach ([1, 2] as $page) {
            $detail = $this->report('lessons/detail', "from={$day}&to={$day}&per_page=100&page={$page}")->assertOk();
            $this->assertSame($totals, $detail->json('totals'));
            $this->assertSame(132, $detail->json('meta.total'));
            $rows += count($detail->json('data'));
            $sum += array_sum(array_column($detail->json('data'), 'scheduled_minutes'));
        }
        $this->assertSame(132, $rows);
        $this->assertSame($totals['scheduled_minutes'], $sum);

        // Exportação: mesmo conjunto, UTF-8 com BOM e separador ";".
        $csv = $this->actingAsUser($this->owner)->get("{$this->base}/reports/lessons/export?from={$day}&to={$day}");
        $csv->assertOk()->assertHeader('content-type', 'text/csv; charset=UTF-8');
        $body = $csv->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $body);
        $lines = array_filter(explode("\n", trim($body)));
        $this->assertCount(133, $lines);
        $this->assertStringContainsString('Duração agendada (min)', $lines[0]);
        $this->assertSame($totals['scheduled_minutes'], collect($lines)->skip(1)->sum(fn ($l) => (int) (str_getcsv($l, ';')[7])));
        $this->assertDatabaseHas('audit_events', ['event' => 'report.exported']);
    }

    public function test_period_uses_the_space_timezone_at_the_day_boundary(): void
    {
        $enrollment = $this->enrollmentFor($this->org);
        $day = now('America/Sao_Paulo')->subDays(3)->toImmutable();
        // 23:30 local do dia D = 02:30 UTC de D+1: pertence ao dia D no fuso do espaço.
        $this->lesson($enrollment, $day->toDateString(), '23:30');
        // 00:15 local de D+1: pertence a D+1.
        $this->lesson($enrollment, $day->addDay()->toDateString(), '00:15');

        $this->report('lessons', 'from='.$day->toDateString().'&to='.$day->toDateString())->assertJsonPath('data.totals.count', 1);
        $this->report('lessons', 'from='.$day->addDay()->toDateString().'&to='.$day->addDay()->toDateString())->assertJsonPath('data.totals.count', 1);
        $this->report('lessons', 'from='.$day->toDateString().'&to='.$day->addDay()->toDateString().'&group_by=day')
            ->assertJsonCount(2, 'data.groups')->assertJsonPath('data.groups.0.key', $day->toDateString());
    }

    public function test_filters_group_by_instructor_vehicle_category_partner_and_cancellations(): void
    {
        $partnerId = $this->actingAsUser($this->owner)->postJson("{$this->base}/partners", ['name' => 'CFC Parceiro'])->assertCreated()->json('data.id');
        $student = Student::factory()->for($this->org)->create();
        $ab = Enrollment::create(['organization_id' => $this->org->getKey(), 'student_id' => $student->getKey(), 'category' => 'AB', 'partner_id' => $partnerId]);
        $b = $this->enrollmentFor($this->org);
        $vehicle = $this->vehicleFor($this->org, overrides: ['plate' => 'ABC1D23']);
        $other = $this->linkInstructor($this->org);
        $day = now('America/Sao_Paulo')->subDays(2)->toDateString();

        $this->lesson($ab, $day, '09:00', extra: ['category' => 'A']);                  // AB parcial: só uma categoria
        $this->lesson($ab, $day, '10:00', extra: ['category' => 'B', 'vehicle_id' => $vehicle->getKey()]);
        $this->lesson($b, $day, '11:00', LessonStatus::Cancelled);
        $this->lesson($b, $day, '13:00', extra: ['instructor_id' => $other->getKey()]);

        $q = "from={$day}&to={$day}";
        $this->report('lessons', "{$q}&category=A")->assertJsonPath('data.totals.count', 1);
        $this->report('lessons', "{$q}&partner_id={$partnerId}")->assertJsonPath('data.totals.count', 2);
        $this->report('lessons', "{$q}&vehicle_id={$vehicle->getKey()}")->assertJsonPath('data.totals.count', 1);
        $this->report('lessons', "{$q}&include_cancelled=0")->assertJsonPath('data.totals.count', 3);
        $this->report('lessons', "{$q}&group_by=instructor")->assertJsonCount(2, 'data.groups');
        $groups = collect($this->report('lessons', "{$q}&group_by=category")->json('data.groups'))->pluck('count', 'key');
        $this->assertSame(1, $groups['A']);
        $this->assertSame(3, $groups['B']);   // a AB conta na categoria da aula (B), sem duplicar a matrícula
        $this->assertSame(4, $this->report('lessons', $q)->json('data.totals.count'));
        $byStatus = collect($this->report('lessons', $q)->json('data.groups'))->pluck('count', 'key');
        $this->assertEquals(['cancelled' => 1, 'completed' => 3], $byStatus->sortKeys()->all());

        // Parceiro: aluno AB contado uma vez, aulas e minutos do parceiro.
        $partners = $this->report('partners', $q)->assertOk()->json('data.partners');
        $this->assertSame(1, $partners[0]['students']);
        $this->assertSame(2, $partners[0]['lessons']);
        $this->assertSame(120, $partners[0]['realized_minutes']);
    }

    public function test_exam_report_shows_numerator_and_denominator_and_keeps_absence_out_of_the_rate(): void
    {
        [$process] = $this->processWithEnrollment($this->org, $this->owner);
        $day = now('America/Sao_Paulo')->subDays(2)->toImmutable();
        $make = function (string $category, int $attempt, string $status) use ($process, $day) {
            return PracticalExam::create([
                'organization_id' => $this->org->getKey(), 'qualification_process_id' => $process->getKey(), 'student_id' => $process->student_id,
                'category' => $category, 'attempt_number' => $attempt, 'scheduled_at' => $day->utc()->setTime(15, 0), 'status' => $status,
            ]);
        };
        $make('B', 1, 'failed');
        $make('B', 2, 'approved');
        $make('A', 1, 'approved');
        $make('A', 2, 'absent');
        $make('B', 3, 'scheduled')->update(['scheduled_at' => now()->subDays(1)]);   // passou sem resultado
        $make('A', 3, 'scheduled')->update(['scheduled_at' => now()->addHour()]);    // dentro do período? depende; abaixo filtramos

        $q = 'from='.$day->toDateString().'&to='.now('America/Sao_Paulo')->addDay()->toDateString();
        $data = $this->report('exams', $q)->assertOk()->json('data');

        $this->assertSame(2, $data['totals']['approved']);
        $this->assertSame(1, $data['totals']['failed']);
        $this->assertSame(1, $data['totals']['absent']);
        $this->assertSame(1, $data['totals']['result_pending']);
        $this->assertEquals(['numerator' => 2, 'denominator' => 3, 'percent' => 66.7], $data['totals']['approval_rate']);
        $b1 = collect($data['rows'])->first(fn ($r) => $r['category'] === 'B' && $r['attempt'] === 1);
        $this->assertEquals(['numerator' => 0, 'denominator' => 1, 'percent' => 0.0], $b1['approval_rate']);

        $this->report('exams/detail', "{$q}&category=B")->assertJsonPath('totals.total', 3)->assertJsonPath('meta.total', 3);
        $csv = $this->actingAsUser($this->owner)->get("{$this->base}/reports/exams/export?{$q}&category=B")->streamedContent();
        $this->assertCount(4, array_filter(explode("\n", trim($csv))));
    }

    public function test_utilization_uses_working_hours_blocks_and_documents_its_basis(): void
    {
        $day = CarbonImmutable::now('America/Sao_Paulo')->addDays(7)->next('monday')->startOfDay();
        $enrollment = $this->enrollmentFor($this->org);
        $this->lesson($enrollment, $day->toDateString(), '09:00', LessonStatus::Scheduled, 120);

        // Agenda livre: padrão seg–sex 08:00–18:00 = 600 min no dia.
        $q = 'from='.$day->toDateString().'&to='.$day->toDateString();
        $row = collect($this->report('utilization', $q)->assertOk()->json('data.instructors'))->first();
        $this->assertSame(600, $row['available_minutes']);
        $this->assertSame(120, $row['used_minutes']);
        $this->assertEquals(['numerator' => 120, 'denominator' => 600, 'percent' => 20.0], $row['utilization']);
        $this->assertNotEmpty($this->report('utilization', $q)->json('data.basis'));

        // Bloqueio de 4 h no instrutor reduz a base.
        $this->actingAsUser($this->owner)->postJson("{$this->base}/availability-blocks", [
            'resource_type' => 'instructor', 'instructor_id' => $this->instructor->getKey(), 'kind' => 'absence', 'reason' => 'Consulta',
            'starts_at' => $day->setTime(14, 0)->utc()->toIso8601String(), 'ends_at' => $day->setTime(18, 0)->utc()->toIso8601String(),
        ])->assertCreated();
        $row = collect($this->report('utilization', $q)->json('data.instructors'))->first();
        $this->assertSame(240, $row['blocked_minutes']);
        $this->assertEquals(['numerator' => 120, 'denominator' => 360, 'percent' => 33.3], $row['utilization']);

        $this->report('utilization', 'from=2026-01-01&to=2026-12-31')->assertStatus(422);
    }

    public function test_processes_report_dashboard_and_student_summary_use_real_data(): void
    {
        [$process, $enrollment] = $this->processWithEnrollment($this->org, $this->owner);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/enrollments/{$enrollment->getKey()}/packages", ['description' => 'Pacote', 'minutes' => 600])->assertCreated();
        $enrollment->update(['status' => 'in_service']);
        $this->lesson($enrollment, now('America/Sao_Paulo')->toDateString(), '08:00', LessonStatus::Completed, 60, ['evolution' => 'Fez baliza.']);
        QualificationProcessTouch::old($process);

        $processes = $this->report('processes')->assertOk()->json('data');
        $this->assertSame($process->getKey(), $processes['stalled'][0]['id'] ?? null);
        $this->assertGreaterThan(15, $processes['stalled'][0]['days_without_movement']);

        $dash = $this->report('dashboard')->assertOk()->json('data');
        $this->assertSame('staff', $dash['scope']);
        $this->assertSame(1, $dash['students_in_service']);
        $this->assertSame(1, $dash['today']['completed']);
        $this->assertSame(1, $dash['week']['total']);

        $summary = $this->actingAsUser($this->owner)->getJson("{$this->base}/students/{$process->student_id}/summary")->assertOk();
        $summary->assertJsonPath('data.enrollments.0.minutes.contracted', 600)
            ->assertJsonPath('data.enrollments.0.minutes.realized', 60)
            ->assertJsonPath('data.enrollments.0.lessons.completed', 1)
            ->assertJsonPath('data.evolution.0.text', 'Fez baliza.')
            ->assertJsonPath('data.processes.0.practice_released', false);
    }

    public function test_only_the_authorized_team_sees_management_reports_and_the_instructor_sees_only_own_summary(): void
    {
        $instructorUser = User::factory()->create();
        $mine = Instructor::factory()->create(['user_id' => $instructorUser->getKey()]);
        $this->org->instructors()->attach($mine->getKey(), ['active' => true]);
        $this->addMember($this->org, $instructorUser, MembershipRole::Instructor);
        $staff = User::factory()->create();
        $this->addMember($this->org, $staff, MembershipRole::Staff);

        $enrollment = $this->enrollmentFor($this->org);
        $day = now('America/Sao_Paulo')->toDateString();
        $this->lesson($enrollment, $day, '08:00', extra: ['instructor_id' => $mine->getKey()]);
        $this->lesson($enrollment, $day, '09:00');

        foreach (['lessons', 'lessons/detail', 'lessons/export', 'exams', 'utilization', 'processes', 'partners'] as $path) {
            $this->report($path, '', $instructorUser)->assertForbidden();
            $this->report($path, '', $staff)->assertOk();
        }

        $this->report('my-summary', "from={$day}&to={$day}", $instructorUser)->assertOk()->assertJsonPath('data.totals.count', 1);
        $this->report('dashboard', '', $instructorUser)->assertOk()->assertJsonPath('data.scope', 'instructor')->assertJsonPath('data.today.total', 1);
        $this->assertArrayNotHasKey('student', $this->report('my-summary', "from={$day}&to={$day}", $instructorUser)->json('data.groups.0') ?? []);

        $this->actingAsUser($instructorUser)->getJson("{$this->base}/students/{$enrollment->student_id}/summary")->assertForbidden();
    }

    public function test_reports_are_isolated_between_organizations(): void
    {
        $enrollment = $this->enrollmentFor($this->org);
        $day = now('America/Sao_Paulo')->toDateString();
        $this->lesson($enrollment, $day, '08:00');

        $other = $this->organizationWithOwner();
        $user = $other->members()->first();
        $this->actingAsUser($user)->getJson($this->prefix."/organizations/{$other->getKey()}/reports/lessons?from={$day}&to={$day}")
            ->assertOk()->assertJsonPath('data.totals.count', 0);
        $this->actingAsUser($user)->getJson("{$this->base}/reports/lessons")->assertNotFound();
        $this->actingAsUser($user)->getJson($this->prefix."/organizations/{$other->getKey()}/students/{$enrollment->student_id}/summary")->assertNotFound();
    }
}

/** Envelhece o processo para simular tempo sem movimentação. */
final class QualificationProcessTouch
{
    public static function old(\App\Models\QualificationProcess $process): void
    {
        \Illuminate\Support\Facades\DB::table('qualification_processes')->where('id', $process->getKey())->update(['updated_at' => now()->subDays(40)]);
        \Illuminate\Support\Facades\DB::table('audit_events')->where('qualification_process_id', $process->getKey())->update(['created_at' => now()->subDays(40)]);
        \Illuminate\Support\Facades\DB::table('lessons')->update(['updated_at' => now()->subDays(40)]);
    }
}
