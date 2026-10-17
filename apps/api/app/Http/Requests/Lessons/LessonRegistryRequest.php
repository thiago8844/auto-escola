<?php

namespace App\Http\Requests\Lessons;

use App\Enums\RegistryStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class LessonRegistryRequest extends FormRequest
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
        $organization = $this->route('organization');

        return [
            'registry_status' => ['required', Rule::enum(RegistryStatus::class)],
            'registry_reference' => ['nullable', 'string', 'max:100'],
            'registry_document_id' => ['nullable', 'integer', Rule::exists('documents', 'id')
                ->where('organization_id', $organization->getKey())],
        ];
    }
}
