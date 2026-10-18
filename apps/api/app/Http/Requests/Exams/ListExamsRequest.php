<?php

namespace App\Http\Requests\Exams;

use App\Enums\ExamStatus;
use App\Enums\LicenseCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListExamsRequest extends FormRequest
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
            'category' => ['nullable', Rule::in(LicenseCategory::simpleValues())],
            'status' => ['nullable', Rule::enum(ExamStatus::class)],
            'student_id' => ['nullable', 'integer'],
            'qualification_process_id' => ['nullable', 'integer'],
            'q' => ['nullable', 'string', 'max:100'],
            'order' => ['nullable', Rule::in(['asc', 'desc'])],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
