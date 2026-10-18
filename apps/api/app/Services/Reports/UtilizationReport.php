<?php

namespace App\Services\Reports;

use App\Models\AvailabilityBlock;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\PracticalExam;
use App\Models\Vehicle;
use Carbon\CarbonImmutable;

/**
 * Utilização e indisponibilidade de instrutores e veículos.
 *
 * Base de cálculo (explícita):
 *  - Horas disponíveis = janelas de atendimento do período no fuso do espaço. Instrutor: o horário do espaço e o do
 *    instrutor, quando definidos (interseção). Sem nenhum horário (agenda livre), vale o padrão segunda a sexta,
 *    08:00–18:00.
 *  - Bloqueado = minutos de bloqueios (manutenção, ausência, férias...) dentro das janelas, até a liberação.
 *  - Utilizado = aulas agendadas e realizadas + exames não cancelados do recurso no período.
 *  - Taxa = utilizado ÷ (disponível − bloqueado). Período máximo: 93 dias.
 */
class UtilizationReport
{
    public const DEFAULT_HOURS = ['1' => [['start' => '08:00', 'end' => '18:00']], '2' => [['start' => '08:00', 'end' => '18:00']], '3' => [['start' => '08:00', 'end' => '18:00']], '4' => [['start' => '08:00', 'end' => '18:00']], '5' => [['start' => '08:00', 'end' => '18:00']]];

    /** @return array<string, mixed> */
    public function run(ReportFilters $f): array
    {
        $org = $f->organization;
        $tz = $f->timezone();
        $instructors = $org->instructors()->wherePivot('active', true)->get();
        $vehicles = Vehicle::query()->where('organization_id', $org->getKey())->where('status', 'active')->orderBy('plate')->get();

        return [
            'basis' => 'Disponível = janelas de atendimento (padrão seg–sex 08:00–18:00 se a agenda é livre); taxa = utilizado ÷ (disponível − bloqueado).',
            'instructors' => $instructors->map(function ($instructor) use ($f, $org, $tz) {
                $weekly = $instructor->pivot->weekly_hours ? json_decode($instructor->pivot->weekly_hours, true) : null;
                $windows = $this->windows($f, $this->hoursFor($org, $weekly), $tz);
                $blocks = AvailabilityBlock::query()->visibleIn($org)->where('resource_type', 'instructor')->where('instructor_id', $instructor->getKey());
                $lessons = Lesson::query()->where('instructor_id', $instructor->getKey())->where('organization_id', $org->getKey())->whereIn('status', ['scheduled', 'completed']);
                $exams = PracticalExam::query()->where('instructor_id', $instructor->getKey())->where('organization_id', $org->getKey())->where('status', '!=', 'cancelled');

                return ['id' => $instructor->getKey(), 'name' => $instructor->full_name] + $this->measure($f, $windows, $blocks, $lessons, $exams);
            })->values()->all(),
            'vehicles' => $vehicles->map(function ($vehicle) use ($f, $org, $tz) {
                $windows = $this->windows($f, $this->hoursFor($org, null), $tz);
                $blocks = AvailabilityBlock::query()->where('organization_id', $org->getKey())->where('resource_type', 'vehicle')->where('vehicle_id', $vehicle->getKey());
                $lessons = Lesson::query()->where('vehicle_id', $vehicle->getKey())->where('organization_id', $org->getKey())->whereIn('status', ['scheduled', 'completed']);
                $exams = PracticalExam::query()->where('vehicle_id', $vehicle->getKey())->where('organization_id', $org->getKey())->where('status', '!=', 'cancelled');

                return ['id' => $vehicle->getKey(), 'name' => "{$vehicle->plate} · {$vehicle->model}"] + $this->measure($f, $windows, $blocks, $lessons, $exams);
            })->values()->all(),
        ];
    }

    /**
     * @param  list<array{0: CarbonImmutable, 1: CarbonImmutable}>  $windows
     * @return array<string, mixed>
     */
    private function measure(ReportFilters $f, array $windows, $blocks, $lessons, $exams): array
    {
        $available = $this->minutes($windows);

        // Bloqueios ativos e já liberados (estes valem até a liberação)
        $blockedWindows = $blocks->get()
            ->map(fn (AvailabilityBlock $b) => [CarbonImmutable::instance($b->starts_at), CarbonImmutable::instance($b->released_at && $b->released_at < $b->ends_at ? $b->released_at : $b->ends_at)])
            ->all();
        $blocked = $this->minutes($this->intersect($windows, $this->merge($blockedWindows)));

        $used = (int) $lessons->clone()->whereBetween('starts_at', [$f->start, $f->end])->get()->sum(fn (Lesson $l) => $l->scheduledMinutes())
            + (int) $exams->clone()->whereBetween('scheduled_at', [$f->start, $f->end])->get()->sum('duration_minutes');

        $free = max($available - $blocked, 0);

        return [
            'available_minutes' => $available,
            'blocked_minutes' => $blocked,
            'used_minutes' => $used,
            'utilization' => ['numerator' => $used, 'denominator' => $free, 'percent' => $free > 0 ? round($used / $free * 100, 1) : null],
        ];
    }

    /** @param array<string, list<array{start: string, end: string}>>|null $instructorHours */
    private function hoursFor(Organization $org, ?array $instructorHours): array
    {
        $orgHours = $org->business_hours;

        if ($orgHours === null && $instructorHours === null) {
            return ['org' => self::DEFAULT_HOURS, 'instructor' => null];
        }

        return ['org' => $orgHours, 'instructor' => $instructorHours];
    }

    /**
     * @param  array{org: ?array, instructor: ?array}  $hours
     * @return list<array{0: CarbonImmutable, 1: CarbonImmutable}>
     */
    private function windows(ReportFilters $f, array $hours, string $tz): array
    {
        $result = [];

        for ($day = $f->start->setTimezone($tz)->startOfDay(); $day <= $f->end->setTimezone($tz); $day = $day->addDay()) {
            $key = (string) $day->isoWeekday();
            $sets = array_filter([$hours['org'][$key] ?? ($hours['org'] === null ? null : []), $hours['instructor'][$key] ?? ($hours['instructor'] === null ? null : [])], fn ($s) => $s !== null);
            $intervals = null;

            foreach ($sets as $set) {
                $current = array_map(fn ($i) => [$day->setTimeFromTimeString($i['start'])->utc(), $day->setTimeFromTimeString($i['end'])->utc()], $set);
                $intervals = $intervals === null ? $current : $this->intersect($intervals, $current);
            }

            foreach ($intervals ?? [] as [$start, $end]) {
                $start = $start < $f->start ? $f->start : $start;
                $end = $end > $f->end ? $f->end : $end;
                if ($end > $start) {
                    $result[] = [$start, $end];
                }
            }
        }

        return $result;
    }

    /** @param list<array{0: CarbonImmutable, 1: CarbonImmutable}> $a @param list<array{0: CarbonImmutable, 1: CarbonImmutable}> $b @return list<array{0: CarbonImmutable, 1: CarbonImmutable}> */
    private function intersect(array $a, array $b): array
    {
        $out = [];

        foreach ($a as [$s1, $e1]) {
            foreach ($b as [$s2, $e2]) {
                $start = $s1 > $s2 ? $s1 : $s2;
                $end = $e1 < $e2 ? $e1 : $e2;
                if ($end > $start) {
                    $out[] = [$start, $end];
                }
            }
        }

        return $out;
    }

    /** @param list<array{0: CarbonImmutable, 1: CarbonImmutable}> $intervals @return list<array{0: CarbonImmutable, 1: CarbonImmutable}> */
    private function merge(array $intervals): array
    {
        usort($intervals, fn ($x, $y) => $x[0] <=> $y[0]);
        $merged = [];

        foreach ($intervals as [$start, $end]) {
            if ($merged !== [] && $start <= $merged[array_key_last($merged)][1]) {
                if ($end > $merged[array_key_last($merged)][1]) {
                    $merged[array_key_last($merged)][1] = $end;
                }
            } else {
                $merged[] = [$start, $end];
            }
        }

        return $merged;
    }

    /** @param list<array{0: CarbonImmutable, 1: CarbonImmutable}> $intervals */
    private function minutes(array $intervals): int
    {
        return (int) array_sum(array_map(fn ($i) => $i[0]->diffInMinutes($i[1]), $intervals));
    }
}
