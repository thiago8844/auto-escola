<?php

namespace App\Http\Requests\Fees;

use App\Enums\FeeParty;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FeeRequest extends FormRequest
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
        $isCreate = $this->isMethod('post');

        return [
            'qualification_process_id' => $isCreate
                ? ['required', 'integer', Rule::exists('qualification_processes', 'id')->where('organization_id', $org)]
                : ['prohibited'],
            'kind' => [$isCreate ? 'required' : 'sometimes', 'string', 'min:2', 'max:60'],
            'voucher_number' => ['nullable', 'string', 'max:60'],
            'amount_cents' => ['nullable', 'integer', 'min:0'],
            'issued_at' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:issued_at'],
            'reference' => ['nullable', 'string', 'max:100'],
            'obligor' => ['sometimes', Rule::enum(FeeParty::class)],
            'notes' => ['nullable', 'string', 'max:2000'],
            'receipt_document_id' => ['nullable', 'integer', Rule::exists('documents', 'id')->where('organization_id', $org)],
            'exam_ids' => ['sometimes', 'array'],
            'exam_ids.*' => ['integer', 'distinct', Rule::exists('practical_exams', 'id')->where('organization_id', $org)],
        ];
    }
}
