<?php

namespace App\Http\Requests\Exams;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RescheduleExamRequest extends FormRequest
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
            'scheduled_at' => ['required', 'date'],
            'duration_minutes' => ['nullable', 'integer', 'min:15', 'max:480'],
            'location' => ['nullable', 'string', 'max:150'],
            'reason' => ['required', 'string', 'min:3', 'max:255'],
            'instructor_id' => ['nullable', 'integer', Rule::exists('organization_instructor', 'instructor_id')->where('organization_id', $org)->where('active', 1)],
            'vehicle_id' => ['nullable', 'integer', Rule::exists('vehicles', 'id')->where('organization_id', $org)->whereNull('deleted_at')],
        ];
    }
}
