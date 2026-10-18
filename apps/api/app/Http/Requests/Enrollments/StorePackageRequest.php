<?php

namespace App\Http\Requests\Enrollments;

use App\Enums\LicenseCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Contratação ou acréscimo de minutos, com a política de consumo/falta/cancelamento acordada.
 */
class StorePackageRequest extends FormRequest
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
            'kind' => ['sometimes', Rule::in(['contract', 'addition'])],
            'description' => ['required', 'string', 'min:3', 'max:150'],
            'minutes' => ['required', 'integer', 'min:1', 'max:100000'],
            // Duração de referência: só com ela o sistema mostra a equivalência em aulas.
            'reference_minutes' => ['nullable', 'integer', 'min:1', 'max:240'],
            'price_cents' => ['nullable', 'integer', 'min:0'],
            'category' => ['nullable', Rule::in(LicenseCategory::simpleValues())],
            'consume_basis' => ['sometimes', Rule::in(['actual', 'scheduled'])],
            'absence_charge' => ['sometimes', Rule::in(['none', 'full'])],
            'late_cancel_charge' => ['sometimes', Rule::in(['none', 'full'])],
            'cancel_notice_hours' => ['nullable', 'integer', 'min:1', 'max:720', 'required_if:late_cancel_charge,full'],
        ];
    }
}
