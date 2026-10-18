<?php

namespace App\Services\Reports;

use App\Models\Lesson;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Relatório de aulas. Uma única consulta-base (com os filtros) alimenta os totais, o agrupamento, a lista de
 * detalhe e a exportação: por isso os números sempre conciliam, em qualquer página.
 *
 * - Data de referência: início da aula (no fuso do espaço).
 * - Duração agendada: fim − início. Duração real: minutos informados (ou a agendada) das aulas REALIZADAS.
 *   Registro oficial confirmado: parte da duração real cuja situação do registro é "confirmado".
 * - Cancelamentos e faltas entram como situações próprias (`include_cancelled=0` os exclui).
 */
class LessonReport
{
    private const SCHEDULED = 'TIMESTAMPDIFF(MINUTE, lessons.starts_at, lessons.ends_at)';

    private const REAL = "CASE WHEN lessons.status = 'completed' THEN COALESCE(lessons.actual_minutes, TIMESTAMPDIFF(MINUTE, lessons.starts_at, lessons.ends_at)) ELSE 0 END";

    private const CONFIRMED = "CASE WHEN lessons.status = 'completed' AND lessons.registry_status = 'confirmed' THEN COALESCE(lessons.actual_minutes, TIMESTAMPDIFF(MINUTE, lessons.starts_at, lessons.ends_at)) ELSE 0 END";

    public const GROUPS = ['status', 'instructor', 'vehicle', 'category', 'partner', 'day'];

    /** @return Builder<Lesson> */
    public function query(ReportFilters $f): Builder
    {
        return Lesson::query()
            ->join('enrollments', 'enrollments.id', '=', 'lessons.enrollment_id')
            ->where('lessons.organization_id', $f->organization->getKey())
            ->where('lessons.starts_at', '>=', $f->start)
            ->where('lessons.starts_at', '<=', $f->end)
            ->when($f->get('instructor_id'), fn ($q, $v) => $q->where('lessons.instructor_id', $v))
            ->when($f->get('vehicle_id'), fn ($q, $v) => $q->where('lessons.vehicle_id', $v))
            ->when($f->get('status'), fn ($q, $v) => $q->where('lessons.status', $v))
            ->when($f->get('category'), fn ($q, $v) => $q->whereRaw('COALESCE(lessons.category, enrollments.category) = ?', [$v]))
            ->when($f->get('partner_id'), fn ($q, $v) => $q->where('enrollments.partner_id', $v))
            ->when(isset($f->values['include_cancelled']) && ! filter_var($f->values['include_cancelled'], FILTER_VALIDATE_BOOLEAN), fn ($q) => $q->where('lessons.status', '!=', 'cancelled'));
    }

    /** @return array{count: int, scheduled_minutes: int, actual_minutes: int, confirmed_minutes: int} */
    public function totals(ReportFilters $f): array
    {
        $row = $this->query($f)->toBase()->selectRaw('COUNT(*) as n, COALESCE(SUM('.self::SCHEDULED.'),0) as s, COALESCE(SUM('.self::REAL.'),0) as r, COALESCE(SUM('.self::CONFIRMED.'),0) as c')->first();

        return ['count' => (int) $row->n, 'scheduled_minutes' => (int) $row->s, 'actual_minutes' => (int) $row->r, 'confirmed_minutes' => (int) $row->c];
    }

    /**
     * @return list<array{key: string|int|null, label: string, count: int, scheduled_minutes: int, actual_minutes: int, confirmed_minutes: int}>
     */
    public function grouped(ReportFilters $f, string $by): array
    {
        $expression = match ($by) {
            'status' => 'lessons.status',
            'instructor' => 'lessons.instructor_id',
            'vehicle' => 'lessons.vehicle_id',
            'partner' => 'enrollments.partner_id',
            'category' => 'COALESCE(lessons.category, enrollments.category)',
            'day' => "DATE(CONVERT_TZ(lessons.starts_at, '+00:00', '{$f->offset()}'))",
        };

        $rows = $this->query($f)->toBase()
            ->selectRaw("{$expression} as k, COUNT(*) as n, COALESCE(SUM(".self::SCHEDULED."),0) as s, COALESCE(SUM(".self::REAL."),0) as r, COALESCE(SUM(".self::CONFIRMED."),0) as c")
            ->groupBy(DB::raw($expression))
            ->orderBy('k')
            ->get();

        $labels = $this->labels($f, $by, $rows->pluck('k')->filter()->all());

        return $rows->map(fn ($row) => [
            'key' => $row->k,
            'label' => $labels[$row->k] ?? ($row->k === null ? 'Não informado' : (string) $row->k),
            'count' => (int) $row->n,
            'scheduled_minutes' => (int) $row->s,
            'actual_minutes' => (int) $row->r,
            'confirmed_minutes' => (int) $row->c,
        ])->all();
    }

    /** @param list<mixed> $keys @return array<string|int, string> */
    private function labels(ReportFilters $f, string $by, array $keys): array
    {
        if ($keys === []) {
            return [];
        }

        return match ($by) {
            'status' => ['scheduled' => 'Agendada', 'completed' => 'Realizada', 'missed' => 'Falta', 'cancelled' => 'Cancelada'],
            'instructor' => DB::table('instructors')->whereIn('id', $keys)->pluck('full_name', 'id')->all(),
            'vehicle' => DB::table('vehicles')->whereIn('id', $keys)->selectRaw("id, CONCAT(plate, ' · ', model) as name")->pluck('name', 'id')->all(),
            'partner' => DB::table('partners')->where('organization_id', $f->organization->getKey())->whereIn('id', $keys)->pluck('name', 'id')->all(),
            default => [],
        };
    }

    /** @return list<string> */
    public static function csvHeaders(): array
    {
        return ['Data e hora', 'Aluno', 'Categoria', 'Instrutor', 'Veículo', 'Parceiro', 'Situação', 'Duração agendada (min)', 'Duração real (min)', 'Registro oficial', 'Motivo'];
    }

    /** @return list<scalar|null> */
    public function csvRow(Lesson $lesson, string $timezone): array
    {
        $status = ['scheduled' => 'Agendada', 'completed' => 'Realizada', 'missed' => 'Falta', 'cancelled' => 'Cancelada'][$lesson->status->value] ?? $lesson->status->value;
        $registry = ['not_informed' => 'Não informado', 'pending' => 'Pendente', 'confirmed' => 'Confirmado', 'rejected' => 'Rejeitado'][$lesson->registry_status->value] ?? '';

        return [
            $lesson->starts_at->setTimezone($timezone)->format('d/m/Y H:i'),
            $lesson->enrollment?->student?->name,
            $lesson->category ?? $lesson->enrollment?->category->value,
            $lesson->instructor?->full_name,
            $lesson->vehicle?->plate,
            $lesson->enrollment?->partner?->name,
            $status,
            $lesson->scheduledMinutes(),
            $lesson->status->value === 'completed' ? ($lesson->actual_minutes ?? $lesson->scheduledMinutes()) : null,
            $lesson->status->value === 'completed' ? $registry : null,
            $lesson->status_reason,
        ];
    }
}
