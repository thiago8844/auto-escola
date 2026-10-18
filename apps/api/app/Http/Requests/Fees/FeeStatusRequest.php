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
            'confirmation_source' => ['nullable', 'string', 'max:150'],
            'paid_by' => ['nullable', Rule::enum(FeeParty::class)],
        ];
    }
}
