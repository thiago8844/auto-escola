<?php

namespace App\Services\Reports;

use Illuminate\Support\Facades\DB;

/**
 * Visão operacional por CFC parceiro (instrutor autônomo): alunos, aulas, minutos e exames no período.
 * Receita e repasse só entram com o financeiro. Alunos são contados uma vez por parceiro, mesmo com matrícula AB.
 */
class PartnerReport
{
    /** @return list<array<string, mixed>> */
    public function run(ReportFilters $f): array
    {
        $org = $f->organization->getKey();

        $lessons = DB::table('lessons')->join('enrollments', 'enrollments.id', '=', 'lessons.enrollment_id')
            ->where('lessons.organization_id', $org)->whereNotNull('enrollments.partner_id')
            ->whereBetween('lessons.starts_at', [$f->start, $f->end])
            ->selectRaw("enrollments.partner_id as pid, COUNT(*) as lessons,
                SUM(lessons.status = 'completed') as completed,
                COALESCE(SUM(CASE WHEN lessons.status = 'completed' THEN COALESCE(lessons.actual_minutes, TIMESTAMPDIFF(MINUTE, lessons.starts_at, lessons.ends_at)) ELSE 0 END),0) as minutes")
            ->groupBy('enrollments.partner_id')->get()->keyBy('pid');

        $exams = DB::table('practical_exams')->join('enrollments', 'enrollments.id', '=', 'practical_exams.enrollment_id')
            ->where('practical_exams.organization_id', $org)->whereNotNull('enrollments.partner_id')
            ->whereBetween('practical_exams.scheduled_at', [$f->start, $f->end])
            ->selectRaw("enrollments.partner_id as pid, COUNT(*) as exams, SUM(practical_exams.status = 'approved') as approved")
            ->groupBy('enrollments.partner_id')->get()->keyBy('pid');

        $students = DB::table('enrollments')->where('organization_id', $org)->whereNotNull('partner_id')
            ->whereIn('status', ['contracted', 'in_service'])
            ->selectRaw('partner_id as pid, COUNT(DISTINCT student_id) as students')->groupBy('partner_id')->get()->keyBy('pid');

        return DB::table('partners')->where('organization_id', $org)->whereNull('deleted_at')->orderBy('name')->get(['id', 'name'])
            ->map(fn ($p) => [
                'id' => $p->id,
                'name' => $p->name,
                'students' => (int) ($students[$p->id]->students ?? 0),
                'lessons' => (int) ($lessons[$p->id]->lessons ?? 0),
                'completed_lessons' => (int) ($lessons[$p->id]->completed ?? 0),
                'realized_minutes' => (int) ($lessons[$p->id]->minutes ?? 0),
                'exams' => (int) ($exams[$p->id]->exams ?? 0),
                'approved_exams' => (int) ($exams[$p->id]->approved ?? 0),
            ])->all();
    }
}
