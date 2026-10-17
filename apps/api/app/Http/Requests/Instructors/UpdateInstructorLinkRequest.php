<?php

namespace App\Http\Requests\Instructors;

use Illuminate\Foundation\Http\FormRequest;

class UpdateInstructorLinkRequest extends FormRequest
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
            'active' => ['required', 'boolean'],
        ];
    }
}
