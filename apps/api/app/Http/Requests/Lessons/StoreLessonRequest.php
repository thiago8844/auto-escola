<?php

namespace App\Http\Requests\Lessons;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreLessonRequest extends FormRequest
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
        $organization = $this->route('organization');

        return [
            'enrollment_id' => ['required', 'integer', Rule::exists('enrollments', 'id')
                ->where('organization_id', $organization->getKey())],
            'instructor_id' => ['required', 'integer', Rule::exists('organization_instructor', 'instructor_id')
                ->where('organization_id', $organization->getKey())
                ->where('active', 1)],
            'vehicle_id' => ['nullable', 'integer', Rule::exists('vehicles', 'id')
                ->where('organization_id', $organization->getKey())
                ->whereNull('deleted_at')],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'notes' => ['nullable', 'string', 'max:2000'],
            // Matrícula conjunta (AB...) sem veículo: informe a categoria da aula.
            'category' => ['nullable', 'string', Rule::in(\App\Enums\LicenseCategory::simpleValues())],
            // Exceção autorizada para agendar com saldo insuficiente; exige motivo.
            'override_reason' => ['nullable', 'string', 'min:3', 'max:255'],
            // Exceção para agendar fora do horário de atendimento configurado; exige motivo.
            'hours_override_reason' => ['nullable', 'string', 'min:3', 'max:255'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [fn (Validator $validator) => $this->assertDurationWithinLimit($validator)];
    }
}
