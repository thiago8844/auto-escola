<?php

namespace App\Http\Requests\Exams;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Remarcação por imprevisto: só a nova data, com o motivo (que vai para o histórico).
 */
class RescheduleExamRequest extends FormRequest
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
            'scheduled_at' => ['required', 'date'],
            'reason' => ['required', 'string', 'min:3', 'max:255'],
        ];
    }
}
