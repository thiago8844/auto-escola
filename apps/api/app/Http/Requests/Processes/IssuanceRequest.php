<?php

namespace App\Http\Requests\Processes;

use App\Enums\ClosureKind;
use App\Enums\IssuanceStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IssuanceRequest extends FormRequest
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
            'status' => ['required', Rule::enum(IssuanceStatus::class)->except(IssuanceStatus::NotStarted)],
            'kind' => ['nullable', Rule::in(['ppd', 'cnh'])],
            'reference' => ['nullable', 'string', 'max:100'],
            'issued_at' => ['nullable', 'date', 'before_or_equal:today'],
            'delivered_at' => ['nullable', 'date', 'after_or_equal:issued_at', 'before_or_equal:today'],
            'document_id' => ['nullable', 'integer', Rule::exists('documents', 'id')->where('organization_id', $org)],
            'definitive_follow_up' => ['sometimes', 'boolean'],
            'definitive_due_at' => ['nullable', 'date'],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }
}
