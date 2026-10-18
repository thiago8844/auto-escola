<?php

namespace App\Http\Requests\Fees;

use App\Enums\FeeParty;
use App\Enums\FeeStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class FeeStatusRequest extends FormRequest
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
            'status' => ['required', Rule::enum(FeeStatus::class)],
            'reason' => ['nullable', 'string', 'max:255'],
            // Comprovante opcional ao confirmar o pagamento (documento já enviado ao espaço).
            'receipt_document_id' => ['nullable', 'integer', Rule::exists('documents', 'id')->where('organization_id', $this->route('organization')->getKey())],
            'paid_by' => ['nullable', Rule::enum(FeeParty::class)],
        ];
    }
}
