<?php

namespace App\Http\Requests\Availability;

use App\Models\AvailabilityBlock;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Bloqueio de agenda. Na alteração só tipo, período e motivo mudam; o recurso é fixo.
 */
class BlockRequest extends FormRequest
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
        $isCreate = $this->isMethod('post');
        $required = $isCreate ? 'required' : 'sometimes';

        return [
            'resource_type' => $isCreate ? ['required', Rule::in(['vehicle', 'instructor'])] : ['prohibited'],
            'vehicle_id' => $isCreate
                ? ['required_if:resource_type,vehicle', 'nullable', 'integer', Rule::exists('vehicles', 'id')->where('organization_id', $org)->whereNull('deleted_at')]
                : ['prohibited'],
            'instructor_id' => $isCreate
                ? ['required_if:resource_type,instructor', 'nullable', 'integer', Rule::exists('organization_instructor', 'instructor_id')->where('organization_id', $org)]
                : ['prohibited'],
            'scope' => $isCreate ? ['sometimes', Rule::in(['organization', 'personal'])] : ['prohibited'],
            'kind' => [$required, Rule::in(AvailabilityBlock::KINDS)],
            'starts_at' => [$required, 'date'],
            'ends_at' => [$required, 'date', 'after:starts_at'],
            'reason' => [$required, 'nullable', 'string', 'min:3', 'max:255'],
        ];
    }
}
