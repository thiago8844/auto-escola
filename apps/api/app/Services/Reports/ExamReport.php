<?php

namespace App\Services\Reports;

use App\Models\PracticalExam;
use Illuminate\Database\Eloquent\Builder;

/**
 * Relatório de exames práticos por categoria e tentativa.
 *
 * Taxa de aprovação = aprovados ÷ (aprovados + reprovados) das tentativas com resultado conclusivo. Ausentes,
 * não concluídos, cancelados e agendados NÃO entram no denominador (ausência não é reprovação). O numerador e o
 * denominador são devolvidos junto com a taxa.
 */
class ExamReport
{
    /** @return Builder<PracticalExam> */
    public function query(ReportFilters $f): Builder
    {
        return PracticalExam::query()
            ->where('practical_exams.organization_id', $f->organization->getKey())
            ->where('practical_exams.scheduled_at', '>=', $f->start)
            ->where('practical_exams.scheduled_at', '<=', $f->end)
            ->when($f->get('category'), fn ($q, $v) => $q->where('practical_exams.category', $v))
            ->when($f->get('status'), fn ($q, $v) => $q->where('practical_exams.status', $v))
            ->when($f->get('attempt'), fn ($q, $v) => $q->where('practical_exams.attempt_number', $v));
    }

    /**
     * @return array{rows: list<array<string, mixed>>, totals: array<string, mixed>}
     */
    public function summary(ReportFilters $f): array
    {
        $now = now();
        $rows = $this->query($f)->toBase()
            ->selectRaw("practical_exams.category as category, practical_exams.attempt_number as attempt,
                COUNT(*) as total,
                SUM(status = 'approved') as approved,
                SUM(status = 'failed') as failed,
                SUM(status = 'absent') as absent,
                SUM(status = 'incomplete') as incomplete,
                SUM(status = 'cancelled') as cancelled,
                SUM(status = 'scheduled' AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) >= ?) as scheduled,
                SUM(status = 'scheduled' AND DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) < ?) as result_pending", [$now, $now])
            ->groupBy('practical_exams.category', 'practical_exams.attempt_number')
            ->orderBy('category')->orderBy('attempt')
            ->get()
            ->map(fn ($r) => $this->row((array) $r))
            ->all();

        $sum = fn (string $key) => array_sum(array_column($rows, $key));
        $totals = $this->row([
            'category' => null, 'attempt' => null, 'total' => $sum('total'), 'approved' => $sum('approved'), 'failed' => $sum('failed'),
            'absent' => $sum('absent'), 'incomplete' => $sum('incomplete'), 'cancelled' => $sum('cancelled'),
            'scheduled' => $sum('scheduled'), 'result_pending' => $sum('result_pending'),
        ]);

        return ['rows' => $rows, 'totals' => $totals];
    }

    /**
     * @param  array<string, mixed>  $r
     * @return array<string, mixed>
     */
    private function row(array $r): array
    {
        $int = fn (string $k) => (int) ($r[$k] ?? 0);
        $denominator = $int('approved') + $int('failed');

        return [
            'category' => $r['category'],
            'attempt' => $r['attempt'] === null ? null : (int) $r['attempt'],
            'total' => $int('total'),
            'scheduled' => $int('scheduled'),
            'approved' => $int('approved'),
            'failed' => $int('failed'),
            'absent' => $int('absent'),
            'incomplete' => $int('incomplete'),
            'cancelled' => $int('cancelled'),
            'result_pending' => $int('result_pending'),
            'approval_rate' => ['numerator' => $int('approved'), 'denominator' => $denominator, 'percent' => $denominator > 0 ? round($int('approved') / $denominator * 100, 1) : null],
        ];
    }

    /** @return list<string> */
    public static function csvHeaders(): array
    {
        return ['Data e hora', 'Aluno', 'Categoria', 'Tentativa', 'Situação', 'Local', 'Protocolo', 'Instrutor', 'Veículo', 'Remarcações'];
    }

    /** @return list<scalar|null> */
    public function csvRow(PracticalExam $exam, string $timezone): array
    {
        $status = ['scheduled' => 'Agendado', 'approved' => 'Aprovado', 'failed' => 'Reprovado', 'absent' => 'Ausente', 'incomplete' => 'Não concluído', 'cancelled' => 'Cancelado'][$exam->status->value] ?? $exam->status->value;

        return [
            $exam->scheduled_at->setTimezone($timezone)->format('d/m/Y H:i'),
            $exam->student?->name,
            $exam->category,
            $exam->attempt_number,
            $status,
            $exam->location,
            $exam->protocol,
            $exam->instructor?->full_name,
            $exam->vehicle?->plate,
            $exam->reschedule_count,
        ];
    }
}
