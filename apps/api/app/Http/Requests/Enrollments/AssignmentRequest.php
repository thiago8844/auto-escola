<?php

namespace App\Http\Requests\Enrollments;

use Illuminate\Foundation\Http\FormRequest;

class AssignmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', [$this->route('enrollment'), $this->route('organization')]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'instructor_id' => ['present', 'nullable', 'integer', 'min:1'],
            'expected_instructor_id' => ['present', 'nullable', 'integer', 'min:1'],
        ];
    }
}
