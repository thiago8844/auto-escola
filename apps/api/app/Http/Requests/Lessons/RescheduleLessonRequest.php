<?php

namespace App\Http\Requests\Lessons;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class RescheduleLessonRequest extends FormRequest
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
        return [
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
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
