<?php

namespace App\Services\Reports;

use App\Enums\LicenseCategory;
use App\Models\Enrollment;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\PracticalExam;
use App\Services\AlertSettings;
use App\Services\CreditLedger;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Relatório de alunos: uma linha por aluno, com a situação de hoje, a agenda, o instrutor responsável e se já pode ser
 * arquivado. Resumo, lista e CSV partem do MESMO conjunto de linhas, então os números sempre conferem.
 *
 * Situação (exclusiva, na ordem):
 *  - archived    cadastro arquivado;
 *  - in_progress matrícula contratada/em atendimento em processo ainda aberto (ou sem processo);
 *  - prospect    só matrícula de interessado, sem contrato;
 *  - qualified   processo concluído;
 *  - dropped     matrícula/processo encerrado sem conclusão;
 *  - registered  só cadastro, sem matrícula.
 *
 * Agenda (só de quem está em habilitação): aula futura > exame futuro > finalizando (emissão do documento) > sem agenda.
 * "Pode arquivar" repete a regra do arquivamento: sem aula/exame agendado e sem matrícula em andamento.
 */
class StudentReport
{
    public const SITUATIONS = ['in_progress', 'prospect', 'qualified', 'dropped', 'registered', 'archived'];

    public const AGENDA = ['with_lesson', 'exam_only', 'finishing', 'no_schedule'];

    public const STALL = ['practice_blocked', 'no_package', 'no_balance', 'ready_to_schedule'];

    public const ARCHIVE = ['ready', 'blocked_enrollment', 'blocked_agenda'];

    private const OPEN = ['prospect', 'contracted', 'in_service'];

    private const FILTERS = ['search', 'situation', 'agenda', 'instructor', 'category', 'partner', 'stall', 'archive', 'idle_days', 'exam'];

    public function __construct(private readonly CreditLedger $ledger, private readonly AlertSettings $settings) {}

    // ----------------------------------------------------------------- linhas

    /** @return Collection<int, array<string, mixed>> */
    public function rows(Organization $org): Collection
    {
        $orgId = $org->getKey();
        $tz = $org->timezone ?: config('autoescola.default_timezone');
        $now = CarbonImmutable::now();
        $today = $now->setTimezone($tz)->startOfDay();
        $config = $this->settings->for($org);
        $lowBalance = (int) $config['low_balance_minutes'];

        $students = DB::table('students')->where('organization_id', $orgId)
            ->get(['id', 'name', 'phone', 'partner_id', 'created_at', 'deleted_at']);

        $enrollments = DB::table('enrollments')->where('organization_id', $orgId)
            ->get(['id', 'student_id', 'status', 'category', 'qualification_process_id', 'assigned_instructor_id', 'assigned_at', 'created_at'])
            ->groupBy('student_id');

        $processes = DB::table('qualification_processes')->where('organization_id', $orgId)
            ->get(['id', 'status', 'closure_kind', 'issuance_status', 'closed_at'])->keyBy('id');

        $blockedProcesses = DB::table('process_checklist_items')->where('organization_id', $orgId)
            ->where('required', true)->whereNotIn('status', ['verified', 'not_applicable'])
            ->distinct()->pluck('qualification_process_id')->flip();

        $lessons = $this->lessonStats($orgId, $now)->groupBy('enrollment_id');
        $exams = $this->examStats($orgId, $now);
        $packages = DB::table('enrollment_packages')->where('organization_id', $orgId)->distinct()->pluck('enrollment_id')->flip();
        $balances = $this->balances($enrollments, $processes);

        $instructorNames = Instructor::query()->whereIn('id', $this->instructorIds($enrollments, $lessons))->pluck('full_name', 'id');
        $partnerNames = DB::table('partners')->where('organization_id', $orgId)->pluck('name', 'id');

        return $students->map(function ($s) use ($enrollments, $processes, $blockedProcesses, $lessons, $exams, $packages, $balances, $instructorNames, $partnerNames, $today, $tz, $lowBalance) {
            $mine = $enrollments->get($s->id, collect());
            $isOpen = fn ($e) => in_array($e->status, self::OPEN, true);
            $processOf = fn ($e) => $e->qualification_process_id ? $processes->get($e->qualification_process_id) : null;
            $processClosed = fn ($e) => in_array($processOf($e)?->status, ['completed', 'closed'], true);
            // Em andamento de verdade: matrícula aberta cujo processo ainda não foi encerrado
            $active = $mine->filter(fn ($e) => $isOpen($e) && ! $processClosed($e));
            $openAny = $mine->filter($isOpen);
            $linkedProcesses = $mine->map($processOf)->filter()->unique('id');
            $completed = $linkedProcesses->where('status', 'completed');

            $situation = match (true) {
                $s->deleted_at !== null => 'archived',
                $active->contains(fn ($e) => $e->status !== 'prospect') => 'in_progress',
                $active->isNotEmpty() => 'prospect',
                $completed->isNotEmpty() => 'qualified',
                $mine->isNotEmpty() => 'dropped',
                default => 'registered',
            };

            // Aulas e instrutores: todas as matrículas do aluno
            $stats = $mine->flatMap(fn ($e) => $lessons->get($e->id, collect()));
            $upcoming = (int) $stats->sum('upcoming');
            $scheduledAny = (int) $stats->sum('scheduled_any');
            $nextLesson = $stats->pluck('next_at')->filter()->min();
            $nextLessonRow = $stats->filter(fn ($r) => $r->next_at !== null)->sortBy('next_at')->first();
            $lastLessonRow = $stats->filter(fn ($r) => $r->last_at !== null)->sortByDesc('last_at')->first();
            $lastLesson = $lastLessonRow?->last_at;

            $exam = $exams[$s->id] ?? ['next_at' => null, 'scheduled' => 0, 'retry' => false, 'approved' => 0];
            $inProgress = $situation === 'in_progress';

            $agenda = null;
            if ($inProgress) {
                $finishing = $active->contains(fn ($e) => ($p = $processOf($e)) && ($p->status === 'awaiting_issuance' || $p->issuance_status !== 'not_started'));
                $agenda = match (true) {
                    $upcoming > 0 => 'with_lesson',
                    $exam['next_at'] !== null => 'exam_only',
                    $finishing => 'finishing',
                    default => 'no_schedule',
                };
            }

            // Saldo das matrículas em andamento
            $withPackage = $active->filter(fn ($e) => $e->status !== 'prospect' && $packages->has($e->id));
            $available = $withPackage->isEmpty() ? null : (int) $withPackage->sum(fn ($e) => $balances[$e->id]['available'] ?? 0);
            $balanceState = match (true) {
                ! $inProgress => null,
                $available === null => 'none',
                $available <= 0 => 'exhausted',
                $available <= $lowBalance => 'low',
                default => 'ok',
            };

            $practiceBlocked = $active->contains(fn ($e) => $e->qualification_process_id && $blockedProcesses->has($e->qualification_process_id));
            $stall = $agenda === 'no_schedule' ? match (true) {
                $practiceBlocked => 'practice_blocked',
                $balanceState === 'none' => 'no_package',
                $balanceState === 'exhausted' => 'no_balance',
                default => 'ready_to_schedule',
            } : null;

            // Dias parado: desde a última aula (ou desde a matrícula, se nunca teve aula)
            $idleDays = null;
            if ($inProgress && $upcoming === 0) {
                $since = $lastLesson
                    ? CarbonImmutable::parse($lastLesson, 'UTC')
                    : CarbonImmutable::parse($active->min('created_at'), 'UTC');
                $idleDays = max(0, (int) $since->setTimezone($tz)->startOfDay()->diffInDays($today));
            }

            // Arquivamento: só para quem já não está em habilitação
            $archive = null;
            $retired = in_array($situation, ['qualified', 'dropped', 'registered'], true);
            if ($retired) {
                $archive = match (true) {
                    $scheduledAny + $exam['scheduled'] > 0 => 'blocked_agenda',
                    $openAny->isNotEmpty() => 'blocked_enrollment',
                    default => 'ready',
                };
            }

            [$instructorId, $instructorSource] = $this->responsible($mine, $active, $nextLessonRow, $lastLessonRow);

            $categories = $mine->filter($isOpen)->pluck('category')->unique()->values();
            if ($categories->isEmpty()) {
                $categories = $mine->pluck('category')->unique()->values();
            }

            $qualifiedAt = $completed->pluck('closed_at')->filter()->max();

            return [
                'id' => (int) $s->id,
                'name' => $s->name,
                'phone' => $s->phone,
                'situation' => $situation,
                'agenda' => $agenda,
                'stall' => $stall,
                'archive' => $archive,
                'categories' => $categories->all(),
                'partner_id' => $s->partner_id === null ? null : (int) $s->partner_id,
                'partner' => $s->partner_id === null ? null : ($partnerNames[$s->partner_id] ?? null),
                'instructor_id' => $instructorId,
                'instructor' => $instructorId === null ? null : ($instructorNames[$instructorId] ?? null),
                'instructor_source' => $instructorSource,
                'upcoming_lessons' => $upcoming,
                'next_lesson_at' => $nextLesson ? CarbonImmutable::parse($nextLesson, 'UTC')->toIso8601String() : null,
                'last_lesson_at' => $lastLesson ? CarbonImmutable::parse($lastLesson, 'UTC')->toIso8601String() : null,
                'idle_days' => $idleDays,
                'completed_lessons' => (int) $stats->sum('completed'),
                'missed_lessons' => (int) $stats->sum('missed'),
                'realized_minutes' => (int) $stats->sum('minutes'),
                'available_minutes' => $inProgress ? $available : null,
                'balance_state' => $balanceState,
                'next_exam_at' => $exam['next_at'] ? CarbonImmutable::parse($exam['next_at'], 'UTC')->toIso8601String() : null,
                'exam_retry' => $inProgress && $exam['retry'],
                'qualified_at' => $qualifiedAt ? CarbonImmutable::parse($qualifiedAt, 'UTC')->toIso8601String() : null,
                'created_at' => CarbonImmutable::parse($s->created_at, 'UTC')->toIso8601String(),
                'archived_at' => $s->deleted_at ? CarbonImmutable::parse($s->deleted_at, 'UTC')->toIso8601String() : null,
            ];
        })->values();
    }

    // ----------------------------------------------------------------- filtros

    /**
     * Aplica todos os filtros, exceto o de instrutor quando $withoutInstructor (para comparar instrutores lado a lado).
     *
     * @param  Collection<int, array<string, mixed>>  $rows
     * @param  array<string, mixed>  $f
     * @return Collection<int, array<string, mixed>>
     */
    public function filter(Collection $rows, array $f, bool $withoutInstructor = false): Collection
    {
        $list = fn (string $key) => collect(explode(',', (string) ($f[$key] ?? '')))->map(fn (string $v) => trim($v))->filter(fn ($v) => $v !== '')->values();
        $situations = $list('situation');
        $agendas = $list('agenda');
        $instructors = $list('instructor');
        $partners = $list('partner');
        $stalls = $list('stall');
        $search = mb_strtolower(trim((string) ($f['search'] ?? '')));
        $category = $f['category'] ?? null;
        $archive = $f['archive'] ?? null;
        $idle = isset($f['idle_days']) && $f['idle_days'] !== '' ? (int) $f['idle_days'] : null;
        $exam = $f['exam'] ?? null;

        return $rows->filter(function (array $r) use ($situations, $agendas, $instructors, $partners, $stalls, $search, $category, $archive, $idle, $exam, $withoutInstructor) {
            // Sem escolher situação, arquivados ficam de fora (o cadastro "vivo")
            if ($situations->isEmpty() ? $r['situation'] === 'archived' : ! $situations->contains($r['situation'])) {
                return false;
            }
            if ($agendas->isNotEmpty() && ! $agendas->contains($r['agenda'])) {
                return false;
            }
            if (! $withoutInstructor && $instructors->isNotEmpty() && ! $instructors->contains($r['instructor_id'] === null ? 'none' : (string) $r['instructor_id'])) {
                return false;
            }
            if ($partners->isNotEmpty() && ! $partners->contains($r['partner_id'] === null ? 'space' : (string) $r['partner_id'])) {
                return false;
            }
            if ($stalls->isNotEmpty() && ! $stalls->contains($r['stall'])) {
                return false;
            }
            if ($category && ! collect($r['categories'])->contains(fn ($c) => $this->covers($c, $category))) {
                return false;
            }
            if ($archive === 'ready' && $r['archive'] !== 'ready') {
                return false;
            }
            if ($archive === 'blocked' && ! in_array($r['archive'], ['blocked_enrollment', 'blocked_agenda'], true)) {
                return false;
            }
            if ($idle !== null && ($r['idle_days'] === null || $r['idle_days'] < $idle)) {
                return false;
            }
            if ($exam === 'scheduled' && $r['next_exam_at'] === null) {
                return false;
            }
            if ($exam === 'retry' && ! $r['exam_retry']) {
                return false;
            }
            if ($search !== '' && ! str_contains(mb_strtolower($r['name']), $search)) {
                return false;
            }

            return true;
        })->values();
    }

    // ----------------------------------------------------------------- resumo

    /**
     * @param  Collection<int, array<string, mixed>>  $all  todos os alunos do espaço
     * @param  array<string, mixed>  $f
     * @return array<string, mixed>
     */
    public function summary(Organization $org, Collection $all, array $f, ReportFilters $period): array
    {
        $scoped = $this->filter($all, $f, withoutInstructor: true);
        $filtered = $this->filter($all, $f);
        $living = $all->where('situation', '!=', 'archived');

        $overview = $this->totals($living) + ['archived' => $all->where('situation', 'archived')->count()];
        $totals = $this->totals($filtered);

        return [
            'as_of' => now()->toIso8601String(),
            'timezone' => $period->timezone(),
            'filtered' => $this->hasFilters($f),
            'overview' => $overview,
            'totals' => $totals,
            'share' => [
                'students' => $this->pct($totals['count'], $overview['count']),
                'in_progress' => $this->pct($totals['in_progress'], $overview['in_progress']),
                'with_lesson' => $this->pct($totals['with_lesson'], $overview['with_lesson']),
                'no_schedule' => $this->pct($totals['no_schedule'], $overview['no_schedule']),
                'qualified' => $this->pct($totals['qualified'], $overview['qualified']),
                'archive_ready' => $this->pct($totals['archive_ready'], $overview['archive_ready']),
            ],
            'situations' => collect(self::SITUATIONS)->map(fn ($k) => ['key' => $k, 'count' => $filtered->where('situation', $k)->count()])->all(),
            'agenda' => collect(self::AGENDA)->map(fn ($k) => ['key' => $k, 'count' => $filtered->where('agenda', $k)->count()])->all(),
            'stall' => collect(self::STALL)->map(fn ($k) => ['key' => $k, 'count' => $filtered->where('stall', $k)->count()])->all(),
            'archive' => collect(self::ARCHIVE)->map(fn ($k) => ['key' => $k, 'count' => $filtered->where('archive', $k)->count()])->all(),
            'idle' => $this->idleBuckets($filtered),
            'balance' => collect(['exhausted', 'low', 'ok', 'none'])->map(fn ($k) => ['key' => $k, 'count' => $filtered->where('balance_state', $k)->count()])->all(),
            'exams' => [
                'scheduled' => $filtered->filter(fn ($r) => $r['situation'] === 'in_progress' && $r['next_exam_at'] !== null)->count(),
                'retry' => $filtered->where('exam_retry', true)->count(),
            ],
            'categories' => $filtered->flatMap(fn ($r) => collect($r['categories'])->map(fn ($c) => ['c' => $c, 'id' => $r['id']]))
                ->groupBy('c')->map(fn ($g, $c) => ['key' => $c, 'count' => $g->pluck('id')->unique()->count()])->sortByDesc('count')->values()->all(),
            'instructors' => $this->byInstructor($scoped, $overview, $f),
            'partners' => $org->type?->value === 'independent' ? $this->byPartner($filtered) : [],
            'movement' => $this->movement($all, $period),
            'basis' => 'Retrato de hoje. Em habilitação = matrícula contratada ou em atendimento em processo ainda aberto. Habilitado = processo concluído. '
                .'Instrutor responsável = o encaminhado à matrícula; sem encaminhamento, o da próxima aula; sem aula futura, o da última aula. '
                .'Pode arquivar = sem aula ou exame agendado e sem matrícula em andamento (a mesma regra do arquivamento).',
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<string, int>
     */
    private function totals(Collection $rows): array
    {
        $inProgress = $rows->where('situation', 'in_progress');

        return [
            'count' => $rows->count(),
            'in_progress' => $inProgress->count(),
            'prospect' => $rows->where('situation', 'prospect')->count(),
            'qualified' => $rows->where('situation', 'qualified')->count(),
            'dropped' => $rows->where('situation', 'dropped')->count(),
            'registered' => $rows->where('situation', 'registered')->count(),
            'with_lesson' => $inProgress->where('agenda', 'with_lesson')->count(),
            'exam_only' => $inProgress->where('agenda', 'exam_only')->count(),
            'finishing' => $inProgress->where('agenda', 'finishing')->count(),
            'no_schedule' => $inProgress->where('agenda', 'no_schedule')->count(),
            'archive_ready' => $rows->where('archive', 'ready')->count(),
            'archive_blocked' => $rows->filter(fn ($r) => in_array($r['archive'], ['blocked_enrollment', 'blocked_agenda'], true))->count(),
        ];
    }

    /**
     * Cada instrutor com os próprios números e a fatia dele sobre o espaço inteiro.
     *
     * @param  Collection<int, array<string, mixed>>  $scoped
     * @param  array<string, int>  $overview
     * @param  array<string, mixed>  $f
     * @return list<array<string, mixed>>
     */
    private function byInstructor(Collection $scoped, array $overview, array $f): array
    {
        $selected = collect(explode(',', (string) ($f['instructor'] ?? '')))->map(fn (string $v) => trim($v))->filter()->all();

        return $scoped->groupBy(fn ($r) => $r['instructor_id'] ?? 'none')->map(function (Collection $g, $key) use ($overview, $selected) {
            $t = $this->totals($g);

            return [
                'id' => $key === 'none' ? null : (int) $key,
                'key' => (string) $key,
                'name' => $key === 'none' ? 'Sem instrutor' : ($g->first()['instructor'] ?? 'Instrutor'),
                'selected' => in_array((string) $key, $selected, true),
                'students' => $t['count'],
                'in_progress' => $t['in_progress'],
                'with_lesson' => $t['with_lesson'],
                'no_schedule' => $t['no_schedule'],
                'qualified' => $t['qualified'],
                'archive_ready' => $t['archive_ready'],
                'share_students' => $this->pct($t['count'], $overview['count']),
                'share_in_progress' => $this->pct($t['in_progress'], $overview['in_progress']),
                'share_with_lesson' => $this->pct($t['with_lesson'], $overview['with_lesson']),
            ];
        })->sortBy([fn ($a, $b) => ($a['id'] === null) <=> ($b['id'] === null), fn ($a, $b) => $b['students'] <=> $a['students']])->values()->all();
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return list<array<string, mixed>>
     */
    private function byPartner(Collection $rows): array
    {
        return $rows->groupBy(fn ($r) => $r['partner_id'] ?? 'space')->map(function (Collection $g, $key) {
            $t = $this->totals($g);

            return ['key' => (string) $key, 'name' => $key === 'space' ? 'Próprio espaço' : ($g->first()['partner'] ?? 'Parceiro')]
                + ['students' => $t['count'], 'in_progress' => $t['in_progress'], 'with_lesson' => $t['with_lesson'], 'no_schedule' => $t['no_schedule'], 'qualified' => $t['qualified']];
        })->sortByDesc('students')->values()->all();
    }

    /**
     * Quem está sem nada agendado, por tempo parado (cumulativo: "7 dias ou mais" inclui os de 30).
     *
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return list<array{key: string, count: int}>
     */
    private function idleBuckets(Collection $rows): array
    {
        $idle = $rows->where('agenda', 'no_schedule');

        return collect([7, 15, 30, 60])->map(fn (int $days) => [
            'key' => "d{$days}",
            'count' => $idle->filter(fn ($r) => $r['idle_days'] >= $days)->count(),
        ])->all();
    }

    /**
     * Movimento do período: entradas e saídas, para a pessoa ver o ritmo da escola.
     *
     * @param  Collection<int, array<string, mixed>>  $all
     * @return array<string, int>
     */
    private function movement(Collection $all, ReportFilters $period): array
    {
        $within = fn (?string $at) => $at !== null && CarbonImmutable::parse($at)->betweenIncluded($period->start, $period->end);

        return [
            'new' => $all->filter(fn ($r) => $within($r['created_at']))->count(),
            'qualified' => $all->filter(fn ($r) => $within($r['qualified_at']))->count(),
            'archived' => $all->filter(fn ($r) => $within($r['archived_at']))->count(),
        ];
    }

    // ----------------------------------------------------------------- lista

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return Collection<int, array<string, mixed>>
     */
    public function sort(Collection $rows, string $by, string $dir): Collection
    {
        $desc = $dir === 'desc';
        // Nulos sempre no fim, em qualquer direção
        $key = fn (array $r) => match ($by) {
            'idle_days' => $r['idle_days'],
            'next_lesson_at' => $r['next_lesson_at'],
            'last_lesson_at' => $r['last_lesson_at'],
            'available_minutes' => $r['available_minutes'],
            'created_at' => $r['created_at'],
            default => mb_strtolower($r['name']),
        };

        $present = $rows->filter(fn ($r) => $key($r) !== null);
        $missing = $rows->filter(fn ($r) => $key($r) === null);

        return $present->sortBy($key, SORT_NATURAL | SORT_FLAG_CASE, $desc)->values()
            ->concat($missing->sortBy(fn ($r) => mb_strtolower($r['name']))->values())->values();
    }

    /** @param array<string, mixed> $f */
    public function hasFilters(array $f): bool
    {
        foreach (self::FILTERS as $key) {
            if (isset($f[$key]) && $f[$key] !== '') {
                return true;
            }
        }

        return false;
    }

    // ----------------------------------------------------------------- CSV

    /** @return list<string> */
    public static function csvHeaders(): array
    {
        return ['Aluno', 'Telefone', 'Situação', 'Agenda', 'Motivo de estar sem aula', 'Instrutor responsável', 'Categorias', 'Autoescola',
            'Aulas agendadas', 'Próxima aula', 'Última aula', 'Dias sem aula', 'Aulas realizadas', 'Faltas', 'Minutos realizados', 'Saldo (min)',
            'Próximo exame', 'Pode arquivar', 'Habilitado em', 'Cadastrado em'];
    }

    /** @return list<scalar|null> */
    public function csvRow(array $r, string $timezone): array
    {
        $date = fn (?string $v, string $fmt = 'd/m/Y') => $v ? CarbonImmutable::parse($v)->setTimezone($timezone)->format($fmt) : null;

        return [
            $r['name'], $r['phone'], self::label('situation', $r['situation']), self::label('agenda', $r['agenda']), self::label('stall', $r['stall']),
            $r['instructor'] ?? ($r['situation'] === 'archived' ? null : 'Sem instrutor'), implode(', ', $r['categories']),
            $r['partner'] ?? 'Próprio espaço', $r['upcoming_lessons'], $date($r['next_lesson_at'], 'd/m/Y H:i'), $date($r['last_lesson_at']),
            $r['idle_days'], $r['completed_lessons'], $r['missed_lessons'], $r['realized_minutes'], $r['available_minutes'],
            $date($r['next_exam_at'], 'd/m/Y H:i'), self::label('archive', $r['archive']), $date($r['qualified_at']), $date($r['created_at']),
        ];
    }

    private static function label(string $kind, ?string $key): ?string
    {
        if ($key === null) {
            return null;
        }

        return [
            'situation' => ['in_progress' => 'Em habilitação', 'prospect' => 'Interessado', 'qualified' => 'Habilitado', 'dropped' => 'Encerrado sem habilitação', 'registered' => 'Só cadastro', 'archived' => 'Arquivado'],
            'agenda' => ['with_lesson' => 'Com aula agendada', 'exam_only' => 'Só com exame agendado', 'finishing' => 'Finalizando (emissão do documento)', 'no_schedule' => 'Sem nada agendado'],
            'stall' => ['practice_blocked' => 'Prática não liberada (documentos pendentes)', 'no_package' => 'Sem pacote de aulas', 'no_balance' => 'Saldo de aulas esgotado', 'ready_to_schedule' => 'Liberado e com saldo: falta agendar'],
            'archive' => ['ready' => 'Sim', 'blocked_enrollment' => 'Não: matrícula ainda aberta', 'blocked_agenda' => 'Não: aula ou exame agendado'],
        ][$kind][$key] ?? $key;
    }

    // ----------------------------------------------------------------- internos

    private function pct(int $part, int $whole): ?float
    {
        return $whole > 0 ? round($part / $whole * 100, 1) : null;
    }

    /** Uma categoria de matrícula (ex.: AB) cobre a categoria simples pedida (A ou B)? */
    private function covers(string $enrollmentCategory, string $wanted): bool
    {
        $enum = LicenseCategory::tryFrom($enrollmentCategory);
        $simple = LicenseCategory::tryFrom($wanted);

        return $enum && $simple ? $enum->covers($simple) || $enum === $simple : $enrollmentCategory === $wanted;
    }

    /**
     * @return array{0: int|null, 1: string|null}
     */
    private function responsible(Collection $all, Collection $active, ?object $next, ?object $last): array
    {
        $assigned = fn (Collection $set) => $set->filter(fn ($e) => $e->assigned_instructor_id !== null)->sortByDesc('assigned_at')->first();
        $pick = $assigned($active) ?? $assigned($all);

        return match (true) {
            $pick !== null => [(int) $pick->assigned_instructor_id, 'assigned'],
            $next !== null => [(int) $next->instructor_id, 'next_lesson'],
            $last !== null => [(int) $last->instructor_id, 'last_lesson'],
            default => [null, null],
        };
    }

    /** @return Collection<int, object> */
    private function lessonStats(int $orgId, CarbonImmutable $now): Collection
    {
        $utc = $now->utc()->format('Y-m-d H:i:s');

        return collect(DB::select(
            "SELECT enrollment_id, instructor_id,
                SUM(status = 'completed') AS completed,
                SUM(status = 'missed') AS missed,
                SUM(status = 'scheduled') AS scheduled_any,
                SUM(status = 'scheduled' AND ends_at > ?) AS upcoming,
                SUM(CASE WHEN status = 'completed' THEN COALESCE(actual_minutes, TIMESTAMPDIFF(MINUTE, starts_at, ends_at)) ELSE 0 END) AS minutes,
                MAX(CASE WHEN status IN ('completed', 'missed') THEN starts_at END) AS last_at,
                MIN(CASE WHEN status = 'scheduled' AND ends_at > ? THEN starts_at END) AS next_at
             FROM lessons WHERE organization_id = ? GROUP BY enrollment_id, instructor_id",
            [$utc, $utc, $orgId],
        ));
    }

    /**
     * Por aluno: próximo exame agendado e se a última tentativa de alguma categoria pede nova tentativa.
     *
     * @return array<int, array{next_at: ?string, scheduled: int, retry: bool, approved: int}>
     */
    private function examStats(int $orgId, CarbonImmutable $now): array
    {
        $limit = $now->utc()->subMinutes(PracticalExam::SLOT_MINUTES)->format('Y-m-d H:i:s');

        return DB::table('practical_exams')->where('organization_id', $orgId)->where('status', '!=', 'cancelled')
            ->orderBy('attempt_number')->get(['student_id', 'category', 'attempt_number', 'status', 'scheduled_at'])
            ->groupBy('student_id')->map(function (Collection $g) use ($limit) {
                $scheduled = $g->where('status', 'scheduled');
                $upcoming = $scheduled->filter(fn ($e) => $e->scheduled_at >= $limit)->min('scheduled_at');
                $last = $g->groupBy('category')->map(fn ($c) => $c->last());

                return [
                    'next_at' => $upcoming,
                    'scheduled' => $scheduled->count(),
                    'approved' => $g->where('status', 'approved')->count(),
                    'retry' => $last->contains(fn ($e) => in_array($e->status, ['failed', 'absent', 'incomplete'], true)),
                ];
            })->all();
    }

    /**
     * Saldo de minutos das matrículas em andamento.
     *
     * @param  Collection<int, Collection<int, object>>  $enrollments
     * @param  Collection<int, object>  $processes
     * @return array<int, array<string, mixed>>
     */
    private function balances(Collection $enrollments, Collection $processes): array
    {
        $ids = $enrollments->flatten(1)
            ->filter(fn ($e) => in_array($e->status, ['contracted', 'in_service'], true)
                && ! in_array($processes->get($e->qualification_process_id)?->status, ['completed', 'closed'], true))
            ->pluck('id');

        $result = [];
        foreach ($ids->chunk(300) as $chunk) {
            $result += $this->ledger->balancesFor(Enrollment::query()->whereIn('id', $chunk->all())->get());
        }

        return $result;
    }

    /**
     * @param  Collection<int, Collection<int, object>>  $enrollments
     * @param  Collection<int, Collection<int, object>>  $lessons
     * @return list<int>
     */
    private function instructorIds(Collection $enrollments, Collection $lessons): array
    {
        return $enrollments->flatten(1)->pluck('assigned_instructor_id')
            ->merge($lessons->flatten(1)->pluck('instructor_id'))->filter()->unique()->values()->all();
    }
}
