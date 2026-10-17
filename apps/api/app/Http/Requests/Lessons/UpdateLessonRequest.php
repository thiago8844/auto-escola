<?php

namespace App\Http\Requests\Lessons;

use Illuminate\Foundation\Http\FormRequest;

class UpdateLessonRequest extends FormRequest
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
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'evolution' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'actual_minutes' => ['sometimes', 'integer', 'min:1', 'max:'.self::MAX_DURATION_MINUTES],
        ];
    }
}
