<?php

namespace App\Http\Requests\Organizations;

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
            'timezone' => ['sometimes', 'timezone:all'],
        ];
    }
}
