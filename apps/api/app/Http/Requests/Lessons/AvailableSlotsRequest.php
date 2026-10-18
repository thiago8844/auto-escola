<?php

namespace App\Http\Requests\Lessons;

use App\Enums\LicenseCategory;
use App\Models\Lesson;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AvailableSlotsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', [Lesson::class, $this->route('organization')]);
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $organization = $this->route('organization');

        return [
            'enrollment_id' => ['required', 'integer', Rule::exists('enrollments', 'id')->where('organization_id', $organization->getKey())],
            'instructor_id' => ['required', 'integer', Rule::exists('organization_instructor', 'instructor_id')->where('organization_id', $organization->getKey())->where('active', 1)],
            'vehicle_id' => ['nullable', 'integer', Rule::exists('vehicles', 'id')->where('organization_id', $organization->getKey())->whereNull('deleted_at')],
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:'.now($organization->timezone)->toDateString()],
            'from_time' => ['sometimes', 'date_format:H:i'],
            'duration' => ['required', 'integer', 'min:1', 'max:240'],
            'category' => ['nullable', Rule::in(LicenseCategory::simpleValues())],
        ];
    }
}
