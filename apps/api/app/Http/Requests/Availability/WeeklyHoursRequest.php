<?php

namespace App\Http\Requests\Availability;

use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Horário semanal: { "1": [{"start":"08:00","end":"12:00"}], ... } ou null (agenda livre com bloqueios).
 */
class WeeklyHoursRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public static function hoursRules(string $field): array
    {
        return [
            $field => ['nullable', 'array'],
            "{$field}.*" => ['nullable', 'array', 'max:4'],
            "{$field}.*.*.start" => ['required', 'date_format:H:i'],
            "{$field}.*.*.end" => ['required', 'date_format:H:i'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return self::hoursRules('weekly_hours');
    }

    public static function validateShape(Validator $validator, string $field, ?array $hours): void
    {
        foreach ($hours ?? [] as $day => $intervals) {
            if (! in_array((string) $day, ['1', '2', '3', '4', '5', '6', '7'], true)) {
                $validator->errors()->add($field, 'Dia da semana inválido.');

                continue;
            }

            $sorted = collect($intervals ?? [])->sortBy('start')->values();

            foreach ($sorted as $i => $interval) {
                if ($interval['end'] <= $interval['start']) {
                    $validator->errors()->add($field, 'O fim de cada faixa deve ser depois do início.');
                }

                if ($i > 0 && $interval['start'] < $sorted[$i - 1]['end']) {
                    $validator->errors()->add($field, 'As faixas de um mesmo dia não podem se sobrepor.');
                }
            }
        }
    }

    public function after(): array
    {
        return [fn (Validator $validator) => self::validateShape($validator, 'weekly_hours', $this->input('weekly_hours'))];
    }
}
