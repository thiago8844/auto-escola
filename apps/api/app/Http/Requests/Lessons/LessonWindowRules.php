<?php

namespace App\Http\Requests\Lessons;

use Carbon\CarbonImmutable;
use Illuminate\Validation\Validator;

/**
 * Regras de janela de tempo compartilhadas por criação e remarcação de aulas.
 */
trait LessonWindowRules
{
    /** Duração máxima de uma aula, em minutos. */
    public const MAX_DURATION_MINUTES = 240;

    protected function assertDurationWithinLimit(Validator $validator): void
    {
        $start = $this->input('starts_at');
        $end = $this->input('ends_at');

        if (! is_string($start) || ! is_string($end) || $validator->errors()->isNotEmpty()) {
            return;
        }

        $minutes = CarbonImmutable::parse($start)->diffInMinutes(CarbonImmutable::parse($end));

        if ($minutes > self::MAX_DURATION_MINUTES) {
            $validator->errors()->add('ends_at', 'A aula não pode durar mais de '.self::MAX_DURATION_MINUTES.' minutos.');
        }
    }
}
