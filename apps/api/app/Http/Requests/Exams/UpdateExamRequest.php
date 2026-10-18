<?php

namespace App\Http\Requests\Exams;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Edição de um exame: corrige qualquer informação, inclusive a data (digitada errada, por exemplo).
 * Remarcar por imprevisto, com motivo no histórico, é outra operação.
 */
class UpdateExamRequest extends FormRequest
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
        $org = $this->route('organization')->getKey();

        return [
            'scheduled_at' => ['sometimes', 'date'],
            'location' => ['sometimes', 'nullable', 'string', 'max:150'],
            'notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'partner_id' => ['sometimes', 'nullable', 'integer', Rule::exists('partners', 'id')->where('organization_id', $org)->whereNull('deleted_at')],
            'instructor_id' => ['sometimes', 'nullable', 'integer', Rule::exists('organization_instructor', 'instructor_id')->where('organization_id', $org)->where('active', 1)],
            'vehicle_id' => ['sometimes', 'nullable', 'integer', Rule::exists('vehicles', 'id')->where('organization_id', $org)->whereNull('deleted_at')],
        ];
    }
}
