<?php

namespace App\Http\Requests\Lessons;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreLessonRequest extends FormRequest
{
    use LessonWindowRules;

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
            'enrollment_id' => ['required', 'integer', Rule::exists('enrollments', 'id')
                ->where('organization_id', $organization->getKey())],
            'instructor_id' => ['required', 'integer', Rule::exists('organization_instructor', 'instructor_id')
                ->where('organization_id', $organization->getKey())
                ->where('active', 1)],
            'vehicle_id' => ['nullable', 'integer', Rule::exists('vehicles', 'id')
                ->where('organization_id', $organization->getKey())
                ->whereNull('deleted_at')],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [fn (Validator $validator) => $this->assertDurationWithinLimit($validator)];
    }
}
