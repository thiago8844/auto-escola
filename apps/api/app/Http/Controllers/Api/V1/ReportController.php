<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\PracticalExam;
use App\Models\Student;
use App\Services\Audit;
use App\Services\Reports\Csv;
use App\Services\Reports\Dashboard;
use App\Services\Reports\ExamReport;
use App\Services\Reports\LessonReport;
use App\Services\Reports\PartnerReport;
use App\Services\Reports\ProcessReport;
use App\Services\Reports\ReportFilters;
use App\Services\Reports\StudentSummary;
use App\Services\Reports\UtilizationReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Relatórios de gestão: só a equipe de operação. O instrutor acessa apenas o painel e o resumo das próprias aulas.
 * Todos os filtros são aplicados na API sobre TODOS os registros elegíveis; totais, detalhe e exportação usam a mesma
 * consulta e, por isso, conciliam em qualquer página.
 */
class ReportController extends Controller
{
    private const PERIOD = ['from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from']];

    public function dashboard(Request $request, Organization $organization, Dashboard $dashboard): JsonResponse
    {
        return response()->json(['data' => $this->isOperator($request) ? $dashboard->staff($organization, $request->user()) : $dashboard->instructor($organization, $request->user())]);
    }

    public function lessons(Request $request, Organization $organization, LessonReport $report): JsonResponse
    {
        $f = $this->filters($request, $organization, $this->lessonRules());
        $by = $request->validate(['group_by' => ['nullable', Rule::in(LessonReport::GROUPS)]])['group_by'] ?? 'status';

        return response()->json(['data' => [
            'period' => $f->period(),
            'group_by' => $by,
            'totals' => $report->totals($f),
            'groups' => $report->grouped($f, $by),
            'basis' => 'Data de referência: início da aula no fuso do espaço. Duração real e registro oficial confirmado consideram só aulas realizadas.',
        ]]);
    }

    public function lessonDetail(Request $request, Organization $organization, LessonReport $report): JsonResponse
    {
        $f = $this->filters($request, $organization, $this->lessonRules());
        $page = $report->query($f)->select('lessons.*')
            ->with(['enrollment.student:id,name', 'enrollment.partner:id,name', 'instructor:id,full_name', 'vehicle:id,plate'])
            ->orderBy('lessons.starts_at')->orderBy('lessons.id')
            ->paginate($this->perPage($request));

        $tz = $f->timezone();

        return response()->json([
            'data' => collect($page->items())->map(fn (Lesson $l) => [
                'id' => $l->getKey(),
                'starts_at' => $l->starts_at->toIso8601String(),
                'student' => $l->enrollment?->student?->name,
                'enrollment_id' => $l->enrollment_id,
                'category' => $l->category ?? $l->enrollment?->category->value,
                'instructor' => $l->instructor?->full_name,
                'vehicle' => $l->vehicle?->plate,
                'partner' => $l->enrollment?->partner?->name,
                'status' => $l->status->value,
                'scheduled_minutes' => $l->scheduledMinutes(),
                'actual_minutes' => $l->status->value === 'completed' ? ($l->actual_minutes ?? $l->scheduledMinutes()) : null,
                'registry_status' => $l->registry_status->value,
            ])->all(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total(), 'timezone' => $tz],
            'totals' => $report->totals($f),
        ]);
    }

    public function lessonExport(Request $request, Organization $organization, LessonReport $report, Audit $audit): StreamedResponse
    {
        $f = $this->filters($request, $organization, $this->lessonRules());
        $tz = $f->timezone();
        $audit->record($organization->getKey(), 'report.exported', 'Exportação CSV de aulas.', ['changes' => $f->values]);

        $rows = (function () use ($report, $f, $tz) {
            $query = $report->query($f)->select('lessons.*')->with(['enrollment.student:id,name', 'enrollment.partner:id,name', 'instructor:id,full_name', 'vehicle:id,plate'])
                ->orderBy('lessons.starts_at')->orderBy('lessons.id');

            foreach ($query->cursor() as $lesson) {
                yield $report->csvRow($lesson, $tz);
            }
        })();

        return Csv::download('aulas-'.now()->format('Ymd-His').'.csv', LessonReport::csvHeaders(), $rows);
    }

    public function exams(Request $request, Organization $organization, ExamReport $report): JsonResponse
    {
        $f = $this->filters($request, $organization, $this->examRules());

        return response()->json(['data' => [
            'period' => $f->period(),
            'basis' => 'Taxa de aprovação = aprovados ÷ (aprovados + reprovados). Ausentes, não concluídos, cancelados e agendados ficam fora do denominador.',
        ] + $report->summary($f)]);
    }

    public function examDetail(Request $request, Organization $organization, ExamReport $report): JsonResponse
    {
        $f = $this->filters($request, $organization, $this->examRules());
        $page = $report->query($f)->with(['student:id,name', 'instructor:id,full_name', 'vehicle:id,plate'])
            ->orderBy('practical_exams.scheduled_at')->orderBy('practical_exams.id')->paginate($this->perPage($request));

        return response()->json([
            'data' => collect($page->items())->map(fn (PracticalExam $e) => [
                'id' => $e->getKey(), 'scheduled_at' => $e->scheduled_at->toIso8601String(), 'student' => $e->student?->name,
                'category' => $e->category, 'attempt' => $e->attempt_number, 'status' => $e->status->value, 'location' => $e->location,
            ])->all(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
            'totals' => $report->summary($f)['totals'],
        ]);
    }

    public function examExport(Request $request, Organization $organization, ExamReport $report, Audit $audit): StreamedResponse
    {
        $f = $this->filters($request, $organization, $this->examRules());
        $tz = $f->timezone();
        $audit->record($organization->getKey(), 'report.exported', 'Exportação CSV de exames.', ['changes' => $f->values]);

        $rows = (function () use ($report, $f, $tz) {
            foreach ($report->query($f)->with(['student:id,name', 'partner:id,name', 'instructor:id,full_name', 'vehicle:id,plate'])->orderBy('practical_exams.scheduled_at')->orderBy('practical_exams.id')->cursor() as $exam) {
                yield $report->csvRow($exam, $tz);
            }
        })();

        return Csv::download('exames-'.now()->format('Ymd-His').'.csv', ExamReport::csvHeaders(), $rows);
    }

    public function utilization(Request $request, Organization $organization, UtilizationReport $report): JsonResponse
    {
        $f = $this->filters($request, $organization, self::PERIOD);

        if ($f->start->diffInDays($f->end) > 93) {
            abort(422, 'O período da utilização pode ter no máximo 93 dias.');
        }

        return response()->json(['data' => ['period' => $f->period()] + $report->run($f)]);
    }

    public function processes(Request $request, Organization $organization, ProcessReport $report): JsonResponse
    {
        $this->operatorsOnly($request);
        $data = $request->validate(['stalled_days' => ['nullable', 'integer', 'between:1,365'], 'document_days' => ['nullable', 'integer', 'between:1,365']]);

        return response()->json(['data' => $report->run($organization, (int) ($data['stalled_days'] ?? 15), (int) ($data['document_days'] ?? 30))]);
    }

    public function partners(Request $request, Organization $organization, PartnerReport $report): JsonResponse
    {
        $f = $this->filters($request, $organization, self::PERIOD);

        return response()->json(['data' => ['period' => $f->period(), 'partners' => $report->run($f), 'basis' => 'Operação por parceiro; receita e repasse só entram com o financeiro.']]);
    }

    public function studentSummary(Request $request, Organization $organization, Student $student, StudentSummary $summary): JsonResponse
    {
        $this->operatorsOnly($request);

        return response()->json(['data' => $summary->for($student, $organization->timezone ?: config('autoescola.default_timezone'))]);
    }

    /**
     * Resumo das próprias aulas do instrutor no período (contagens e minutos; nada de alunos, preços ou saúde).
     */
    public function mySummary(Request $request, Organization $organization): JsonResponse
    {
        $instructor = $request->user()->instructor;
        $f = $this->filters($request, $organization, self::PERIOD, operatorsOnly: false);
        $f = new ReportFilters($organization, $f->start, $f->end, ['instructor_id' => $instructor?->getKey() ?? 0]);

        return response()->json(['data' => [
            'period' => $f->period(),
            'totals' => app(LessonReport::class)->totals($f),
            'groups' => app(LessonReport::class)->grouped($f, 'status'),
        ]]);
    }

    /** @return array<string, mixed> */
    private function lessonRules(): array
    {
        return self::PERIOD + [
            'instructor_id' => ['nullable', 'integer'], 'vehicle_id' => ['nullable', 'integer'], 'partner_id' => ['nullable', 'integer'],
            'category' => ['nullable', Rule::in(\App\Enums\LicenseCategory::simpleValues())],
            'status' => ['nullable', Rule::in(['scheduled', 'completed', 'missed', 'cancelled'])],
            'include_cancelled' => ['nullable', 'boolean'],
        ];
    }

    /** @return array<string, mixed> */
    private function examRules(): array
    {
        return self::PERIOD + [
            'category' => ['nullable', Rule::in(\App\Enums\LicenseCategory::simpleValues())],
            'status' => ['nullable', Rule::in(['scheduled', 'approved', 'failed', 'absent', 'incomplete', 'cancelled'])],
            'attempt' => ['nullable', 'integer', 'min:1'],
        ];
    }

    /** @param array<string, mixed> $rules */
    private function filters(Request $request, Organization $organization, array $rules, bool $operatorsOnly = true): ReportFilters
    {
        if ($operatorsOnly) {
            $this->operatorsOnly($request);
        }

        return ReportFilters::from($organization, $request->validate($rules));
    }

    private function operatorsOnly(Request $request): void
    {
        abort_unless($this->isOperator($request), 403, 'Os relatórios de gestão são da equipe do espaço.');
    }
}
