<?php

namespace App\Http\Requests\Organizations;

use App\Http\Requests\Availability\WeeklyHoursRequest;
use App\Http\Requests\Processes\QualificationProcessRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('state')) {
            $this->merge(['state' => strtoupper(trim((string) $this->input('state')))]);
        }

        if ($this->has('document')) {
            $this->merge(['document' => preg_replace('/\D/', '', (string) $this->input('document'))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $organization = $this->route('organization');

        return [
            // O tipo do espaço não é alterável após a criação.
            'type' => ['prohibited'],
            'name' => ['sometimes', 'string', 'max:150'],
            'document' => ['nullable', 'string', 'max:20', Rule::unique('organizations', 'document')->ignore($organization)],
            'email' => ['nullable', 'email', 'max:150'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', Rule::in(QualificationProcessRequest::UFS)],
            'timezone' => ['sometimes', 'timezone:all'],
        ] + WeeklyHoursRequest::hoursRules('business_hours');
    }

    public function after(): array
    {
        return [fn (Validator $validator) => WeeklyHoursRequest::validateShape($validator, 'business_hours', $this->input('business_hours'))];
    }
}
