<?php

namespace App\Http\Requests\Lessons;

use App\Enums\LessonStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateLessonStatusRequest extends FormRequest
{
    use LessonWindowRules;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::enum(LessonStatus::class)],
            'notes' => ['nullable', 'string', 'max:2000'],
            // Motivo de falta/cancelamento; duração real e evolução só existem em aula realizada.
            'reason' => ['nullable', 'string', 'max:255', 'prohibited_if:status,completed'],
            'actual_minutes' => ['nullable', 'integer', 'min:1', 'max:'.self::MAX_DURATION_MINUTES, 'prohibited_unless:status,completed'],
            'evolution' => ['nullable', 'string', 'max:5000', 'prohibited_unless:status,completed'],
        ];
    }
}
