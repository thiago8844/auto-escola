<?php

namespace App\Http\Requests\Processes;

use App\Enums\ClosureKind;
use App\Enums\IssuanceStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CloseProcessRequest extends FormRequest
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
            'kind' => ['required', Rule::enum(ClosureKind::class)],
            'reason' => ['nullable', 'string', 'min:3', 'max:255'],
            'cancel_future' => ['sometimes', 'boolean'],
            'acknowledge_pending' => ['sometimes', 'boolean'],
        ];
    }
}
