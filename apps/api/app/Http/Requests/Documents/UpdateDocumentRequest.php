<?php

namespace App\Http\Requests\Documents;

use App\Enums\DocumentStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Conferência e metadados. O arquivo não é editável: para trocá-lo, envie uma nova versão
 * informando `replaces_document_id`. `replaced` é definido apenas pela substituição.
 */
class UpdateDocumentRequest extends FormRequest
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
            'status' => ['sometimes', Rule::in([DocumentStatus::Attached->value, DocumentStatus::Verified->value, DocumentStatus::Rejected->value])],
            'issuer' => ['nullable', 'string', 'max:150'],
            'issued_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
