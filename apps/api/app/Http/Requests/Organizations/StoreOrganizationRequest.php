<?php

namespace App\Http\Requests\Organizations;

use App\Enums\OrganizationType;
use App\Http\Requests\Processes\QualificationProcessRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOrganizationRequest extends FormRequest
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
        return [
            'name' => ['required', 'string', 'max:150'],
            'type' => ['required', Rule::enum(OrganizationType::class)],
            'document' => ['nullable', 'string', 'max:20', 'unique:organizations,document'],
            'email' => ['nullable', 'email', 'max:150'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', Rule::in(QualificationProcessRequest::UFS)],
            'timezone' => ['sometimes', 'timezone:all'],
        ];
    }
}
