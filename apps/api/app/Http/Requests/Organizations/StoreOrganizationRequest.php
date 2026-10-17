<?php

namespace App\Http\Requests\Organizations;

use App\Enums\OrganizationType;
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
            'timezone' => ['sometimes', 'timezone:all'],
        ];
    }
}
