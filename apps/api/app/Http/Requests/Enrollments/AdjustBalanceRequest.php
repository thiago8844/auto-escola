<?php

namespace App\Http\Requests\Enrollments;

use App\Enums\LicenseCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdjustBalanceRequest extends FormRequest
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
            'minutes' => ['required', 'integer', 'not_in:0', 'between:-100000,100000'],
            'category' => ['nullable', Rule::in(LicenseCategory::simpleValues())],
            'reason' => ['required', 'string', 'min:3', 'max:255'],
        ];
    }
}
