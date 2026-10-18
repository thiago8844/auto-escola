<?php

namespace App\Http\Requests\Exams;

use App\Enums\ExamStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Resultado/cancelamento (status ≠ agendado). Usado também na correção, com motivo obrigatório.
 */
class ExamResultRequest extends FormRequest
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
            'status' => ['required', Rule::enum(ExamStatus::class)->except(ExamStatus::Scheduled)],
            'reason' => ['nullable', 'string', 'min:3', 'max:255'],
        ];
    }
}
