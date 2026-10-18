<?php

namespace App\Services;

use Carbon\CarbonInterface;

/**
 * Horário de atendimento semanal: { "1": [{"start":"08:00","end":"12:00"}], ... } (1 = segunda ... 7 = domingo).
 * Regra nula = agenda livre: somente os bloqueios restringem.
 */
class WorkingHours
{
    public const DAY_LABELS = [1 => 'seg', 2 => 'ter', 3 => 'qua', 4 => 'qui', 5 => 'sex', 6 => 'sáb', 7 => 'dom'];

    /**
     * @param  array<string, list<array{start: string, end: string}>>|null  $hours
     */
    public function fits(?array $hours, CarbonInterface $start, CarbonInterface $end, string $timezone): bool
    {
        if ($hours === null) {
            return true;
        }

        $from = $start->setTimezone($timezone);
        $to = $end->setTimezone($timezone);

        if ($from->toDateString() !== $to->toDateString()) {
            return false;
        }

        $startTime = $from->format('H:i');
        $endTime = $to->format('H:i');

        foreach ($hours[(string) $from->isoWeekday()] ?? [] as $interval) {
            if ($startTime >= $interval['start'] && $endTime <= $interval['end']) {
                return true;
            }
        }

        return false;
    }

    /**
     * Resumo legível do dia da aula, para a mensagem de erro.
     *
     * @param  array<string, list<array{start: string, end: string}>>  $hours
     */
    public function describeDay(array $hours, CarbonInterface $at, string $timezone): string
    {
        $day = $at->setTimezone($timezone)->isoWeekday();
        $intervals = $hours[(string) $day] ?? [];

        if ($intervals === []) {
            return self::DAY_LABELS[$day].': sem atendimento';
        }

        return self::DAY_LABELS[$day].' '.collect($intervals)->map(fn ($i) => "{$i['start']}–{$i['end']}")->implode(' e ');
    }

    /**
     * Normaliza a entrada validada: descarta dias sem faixa e ordena as faixas. Retorna null se não houver nenhuma.
     *
     * @param  array<string, mixed>|null  $input
     * @return array<string, list<array{start: string, end: string}>>|null
     */
    public function normalize(?array $input): ?array
    {
        if ($input === null) {
            return null;
        }

        $result = [];

        foreach ($input as $day => $intervals) {
            $clean = collect($intervals ?? [])
                ->map(fn ($i) => ['start' => $i['start'], 'end' => $i['end']])
                ->sortBy('start')
                ->values()
                ->all();

            if ($clean !== []) {
                $result[(string) $day] = $clean;
            }
        }

        return $result === [] ? null : $result;
    }
}
