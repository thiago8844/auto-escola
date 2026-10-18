<?php

namespace App\Http\Requests\Exams;

use App\Enums\LicenseCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreExamRequest extends FormRequest
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
            'qualification_process_id' => ['required', 'integer', Rule::exists('qualification_processes', 'id')->where('organization_id', $org)],
            'enrollment_id' => ['nullable', 'integer', Rule::exists('enrollments', 'id')->where('organization_id', $org)],
            'category' => ['required', Rule::in(LicenseCategory::simpleValues())],
            'scheduled_at' => ['required', 'date'],
            'duration_minutes' => ['nullable', 'integer', 'min:15', 'max:480'],
            'location' => ['nullable', 'string', 'max:150'],
            'protocol' => ['nullable', 'string', 'max:60'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'instructor_id' => ['nullable', 'integer', Rule::exists('organization_instructor', 'instructor_id')->where('organization_id', $org)->where('active', 1)],
            'vehicle_id' => ['nullable', 'integer', Rule::exists('vehicles', 'id')->where('organization_id', $org)->whereNull('deleted_at')],
        ];
    }
}
