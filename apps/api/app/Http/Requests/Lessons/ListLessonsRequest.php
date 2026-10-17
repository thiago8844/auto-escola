<?php

namespace App\Http\Requests\Lessons;

use App\Enums\LessonStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Filtros de agenda. Usado na listagem do espaço e na agenda pessoal (/me/lessons).
 */
class ListLessonsRequest extends FormRequest
{
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
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'status' => ['nullable', Rule::enum(LessonStatus::class)],
            'instructor_id' => ['nullable', 'integer'],
            'enrollment_id' => ['nullable', 'integer'],
            'vehicle_id' => ['nullable', 'integer'],
            // Fuso usado para interpretar from/to na agenda pessoal (no espaço, vale o fuso do espaço).
            'timezone' => ['nullable', 'timezone:all'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
