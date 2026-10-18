<?php

namespace App\Services\Reports;

use App\Models\Organization;
use Carbon\CarbonImmutable;

/**
 * Período e filtros de um relatório. Os dias `from`/`to` valem no FUSO DO ESPAÇO (início do primeiro dia até o fim
 * do último, inclusive) e são convertidos para UTC; a data de referência é o início da aula ou do exame.
 */
final class ReportFilters
{
    public function __construct(
        public readonly Organization $organization,
        public readonly CarbonImmutable $start,
        public readonly CarbonImmutable $end,
        /** @var array<string, mixed> */
        public readonly array $values,
    ) {}

    /** @param array<string, mixed> $input */
    public static function from(Organization $organization, array $input, int $defaultDays = 30): self
    {
        $timezone = $organization->timezone ?: config('autoescola.default_timezone');
        $today = CarbonImmutable::now($timezone)->startOfDay();

        $from = ! empty($input['from']) ? CarbonImmutable::parse($input['from'], $timezone)->startOfDay() : $today->subDays($defaultDays - 1);
        $to = ! empty($input['to']) ? CarbonImmutable::parse($input['to'], $timezone)->endOfDay() : $today->endOfDay();

        return new self($organization, $from->utc(), $to->utc(), $input);
    }

    public function timezone(): string
    {
        return $this->organization->timezone ?: config('autoescola.default_timezone');
    }

    public function get(string $key): mixed
    {
        $value = $this->values[$key] ?? null;

        return $value === '' ? null : $value;
    }

    /** @return array{from: string, to: string, timezone: string} */
    public function period(): array
    {
        return [
            'from' => $this->start->setTimezone($this->timezone())->toDateString(),
            'to' => $this->end->setTimezone($this->timezone())->toDateString(),
            'timezone' => $this->timezone(),
        ];
    }

    /** Deslocamento do fuso em relação ao UTC no fim do período, no formato "+HH:MM" (para agrupar por dia no SQL). */
    public function offset(): string
    {
        return $this->end->setTimezone($this->timezone())->format('P');
    }
}
