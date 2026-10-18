<?php

namespace Tests\Feature\Api;

use App\Enums\LessonStatus;
use App\Enums\LicenseCategory;
use App\Enums\MembershipRole;
use App\Models\Enrollment;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\QualificationProcess;
use App\Models\Student;
use App\Models\User;
use App\Services\CreditLedger;
use Illuminate\Support\Facades\DB;

/**
 * Relatório de alunos: situação, agenda, instrutor responsável, motivo de estar parado e "pode arquivar".
 */
class StudentReportTest extends ApiTestCase
{
    private User $owner;

    private Organization $org;

    private Instructor $ana;

    private Instructor $beto;

    private string $base;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->org = $this->organizationWithOwner('cfc', $this->owner);
        $this->ana = $this->linkInstructor($this->org);
        $this->beto = $this->linkInstructor($this->org);
        $this->base = $this->prefix."/organizations/{$this->org->getKey()}/reports/students";
    }

    private function fetch(string $path = '', string $query = '', ?User $as = null)
    {
        return $this->actingAsUser($as ?? $this->owner)->getJson($this->base.$path.($query ? "?{$query}" : ''));
    }

    /** Aluno com matrícula (e processo) no estado pedido. */
    private function student(string $name, string $enrollment = 'in_service', ?string $process = 'active', ?Instructor $assigned = null, bool $released = true, ?int $minutes = 600): Student
    {
        $student = Student::factory()->for($this->org)->create(['name' => $name]);
        $processId = null;

        if ($process !== null) {
            $processId = QualificationProcess::create([
                'organization_id' => $this->org->getKey(), 'student_id' => $student->getKey(), 'type' => 'first_license', 'uf' => 'MG',
                'current_categories' => [], 'target_categories' => ['B'], 'status' => $process,
                'closure_kind' => in_array($process, ['completed'], true) ? 'completed' : (in_array($process, ['closed'], true) ? 'abandoned' : null),
                'closed_at' => in_array($process, ['completed', 'closed'], true) ? now()->subDay() : null,
            ])->getKey();

            if (! $released) {
                $this->checklist($processId);
            }
        }

        $e = Enrollment::create([
            'organization_id' => $this->org->getKey(), 'student_id' => $student->getKey(), 'qualification_process_id' => $processId,
            'category' => LicenseCategory::B, 'status' => $enrollment,
        ]);
        $e->forceFill(['assigned_instructor_id' => $assigned?->getKey(), 'assigned_at' => $assigned ? now() : null])->save();

        if ($minutes !== null && in_array($enrollment, ['contracted', 'in_service'], true)) {
            app(CreditLedger::class)->grant($e, ['description' => 'Pacote', 'minutes' => $minutes]);
        }

        return $student;
    }

    private function checklist(int $processId): void
    {
        DB::table('process_checklist_items')->insert([
            'organization_id' => $this->org->getKey(), 'qualification_process_id' => $processId, 'type' => 'medical_exam',
            'required' => true, 'status' => 'pending', 'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    private function lessonOf(Student $student, Instructor $by, string $when, LessonStatus $status = LessonStatus::Scheduled): void
    {
        $start = now()->utc()->modify($when)->setTime(10, 0);
        $this->lessonFor($this->org, $by, Enrollment::where('student_id', $student->getKey())->firstOrFail(), $start->toIso8601String(), $start->addHour()->toIso8601String(), $status);
    }

    /** Cenário do dono: 11 alunos cobrindo todas as perguntas. */
    private function scenario(): void
    {
        $ana = $this->student('Alice', assigned: $this->ana);          // com aula
        $this->lessonOf($ana, $this->ana, '+2 days');
        $bia = $this->student('Bia', assigned: $this->ana, released: false);   // parada: prática não liberada
        $caio = $this->student('Caio', assigned: $this->beto);          // parada: liberada e com saldo
        $this->lessonOf($caio, $this->beto, '-20 days', LessonStatus::Completed);
        $this->student('Davi', assigned: $this->beto, minutes: null);   // parada: sem pacote
        $this->student('Eva', 'contracted', 'active', $this->beto, minutes: 600);
        $this->student('Fabi', 'prospect', null, minutes: null);        // interessado
        $gabi = $this->student('Gabi', 'closed', 'completed');           // habilitada, pode arquivar
        $this->lessonOf($gabi, $this->ana, '-40 days', LessonStatus::Completed);
        $this->student('Hugo', 'in_service', 'completed', $this->ana);  // habilitado, matrícula ainda aberta
        $this->student('Iara', 'terminated', 'closed');                  // desistiu
        Student::factory()->for($this->org)->create(['name' => 'Joao']); // só cadastro
        $this->student('Kleber', 'closed', 'completed')->delete();       // arquivado
    }

    public function test_summary_answers_the_owners_questions(): void
    {
        $this->scenario();

        $data = $this->fetch()->assertOk()->json('data');

        // quantos tenho / quantos arquivados
        $this->assertSame(10, $data['overview']['count']);
        $this->assertSame(1, $data['overview']['archived']);
        // em habilitação: Alice, Bia, Caio, Davi, Eva
        $this->assertSame(5, $data['totals']['in_progress']);
        $this->assertSame(1, $data['totals']['prospect']);
        $this->assertSame(2, $data['totals']['qualified']);   // Gabi e Hugo
        $this->assertSame(1, $data['totals']['dropped']);
        $this->assertSame(1, $data['totals']['registered']);
        // com aula x boiando (Eva: contratada, sem aula)
        $this->assertSame(1, $data['totals']['with_lesson']);
        $this->assertSame(4, $data['totals']['no_schedule']);
        // por quê estão parados
        $stall = collect($data['stall'])->pluck('count', 'key');
        $this->assertSame(1, $stall['practice_blocked']);
        $this->assertSame(1, $stall['no_package']);
        $this->assertSame(2, $stall['ready_to_schedule']);
        // pode arquivar: Gabi, Iara e Joao; Hugo ainda tem matrícula aberta
        $this->assertSame(3, $data['totals']['archive_ready']);
        $this->assertSame(1, $data['totals']['archive_blocked']);
    }

    public function test_instructors_are_compared_and_selection_shows_the_share(): void
    {
        $this->scenario();

        $all = collect($this->fetch()->json('data.instructors'));
        $ana = $all->firstWhere('id', $this->ana->getKey());
        $beto = $all->firstWhere('id', $this->beto->getKey());
        $none = $all->firstWhere('id', null);

        // Alice, Bia, Hugo (encaminhados) e Gabi (última aula foi com ela)
        $this->assertSame([4, 2, 1, 1], [$ana['students'], $ana['in_progress'], $ana['with_lesson'], $ana['no_schedule']]);
        $this->assertSame([3, 3, 0, 3], [$beto['students'], $beto['in_progress'], $beto['with_lesson'], $beto['no_schedule']]);
        $this->assertSame(3, $none['students']);
        $this->assertSame('Sem instrutor', $none['name']);
        $this->assertEquals(40.0, $ana['share_students']);

        // juntar os dois: participação sobre o espaço inteiro
        $ids = $this->ana->getKey().','.$this->beto->getKey();
        $sel = $this->fetch('', "instructor={$ids}")->json('data');
        $this->assertTrue($sel['filtered']);
        $this->assertSame(7, $sel['totals']['count']);
        $this->assertEquals(70.0, $sel['share']['students']);
        $this->assertEquals(100.0, $sel['share']['in_progress']);
        $this->assertEquals(100.0, $sel['share']['with_lesson']);

        // escolher um instrutor não esconde os outros na comparação
        $onlyAna = $this->fetch('', 'instructor='.$this->ana->getKey())->json('data');
        $this->assertEquals(40.0, $onlyAna['share']['in_progress']);
        $this->assertCount(3, $onlyAna['instructors']);
        $this->assertTrue(collect($onlyAna['instructors'])->firstWhere('id', $this->ana->getKey())['selected']);
    }

    public function test_detail_filters_sorts_and_paginates_the_same_set(): void
    {
        $this->scenario();

        $names = fn (string $q) => collect($this->fetch('/detail', $q)->assertOk()->json('data'))->pluck('name')->all();

        $this->assertSame(['Bia', 'Caio', 'Davi', 'Eva'], $names('agenda=no_schedule'));
        $this->assertSame(['Bia'], $names('stall=practice_blocked'));
        $this->assertSame(['Davi'], $names('stall=no_package'));
        $this->assertSame(['Gabi', 'Iara', 'Joao'], $names('archive=ready'));
        $this->assertSame(['Hugo'], $names('archive=blocked'));
        $this->assertSame(['Kleber'], $names('situation=archived'));
        $this->assertSame(['Caio'], $names('agenda=no_schedule&idle_days=15'));
        $this->assertSame(['Joao'], $names('search=joa'));
        $this->assertCount(10, $names(''));

        $page = $this->fetch('/detail', 'per_page=4&page=3&sort=name')->json();
        $this->assertSame(10, $page['meta']['total']);
        $this->assertSame(3, $page['meta']['last_page']);
        $this->assertCount(2, $page['data']);
    }

    public function test_export_matches_the_filtered_list(): void
    {
        $this->scenario();

        $csv = $this->fetch('/export', 'agenda=no_schedule')->assertOk()->streamedContent();
        $lines = array_filter(explode("\n", trim($csv)));

        $this->assertCount(5, $lines);   // cabeçalho + 4 alunos
        $this->assertStringContainsString('Prática não liberada', $csv);
        $this->assertStringNotContainsString('Alice', $csv);
    }

    public function test_only_operators_and_validated_filters(): void
    {
        $this->scenario();
        $instructorUser = User::factory()->create();
        $this->addMember($this->org, $instructorUser, MembershipRole::Instructor);

        $this->fetch('', '', $instructorUser)->assertForbidden();
        $this->fetch('/detail', 'situation=banana')->assertUnprocessable();
        $this->fetch('/detail', 'sort=password')->assertUnprocessable();
    }

    public function test_students_from_other_spaces_never_appear(): void
    {
        $other = $this->organizationWithOwner('cfc');
        Student::factory()->for($other)->create(['name' => 'De outro espaço']);
        $this->scenario();

        $this->assertNotContains('De outro espaço', collect($this->fetch('/detail', 'per_page=50')->json('data'))->pluck('name')->all());
        $this->assertSame(10, $this->fetch()->json('data.overview.count'));
    }
}
