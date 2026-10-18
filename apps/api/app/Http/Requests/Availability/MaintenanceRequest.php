<?php

namespace App\Http\Requests\Availability;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Cadastro/alteração de manutenção. `block` (opcional, só na criação) já bloqueia a agenda do veículo.
 * Na conclusão (`complete`) os mesmos campos descrevem o serviço realizado.
 */
class MaintenanceRequest extends FormRequest
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
        $isCreate = $this->isMethod('post') && $this->route('maintenance') === null;

        return [
            'vehicle_id' => $isCreate
                ? ['required', 'integer', Rule::exists('vehicles', 'id')->where('organization_id', $org)->whereNull('deleted_at')]
                : ['prohibited'],
            'type' => [$isCreate ? 'required' : 'sometimes', 'string', 'min:2', 'max:60'],
            'scheduled_on' => [$isCreate ? 'required' : 'sometimes', 'date'],
            'performed_on' => ['nullable', 'date'],
            'provider' => ['nullable', 'string', 'max:150'],
            'odometer_km' => ['nullable', 'integer', 'min:0', 'max:9999999'],
            'estimated_cost_cents' => ['nullable', 'integer', 'min:0'],
            'actual_cost_cents' => ['nullable', 'integer', 'min:0'],
            'document_id' => ['nullable', 'integer', Rule::exists('documents', 'id')->where('organization_id', $org)],
            'next_due_date' => ['nullable', 'date'],
            'next_due_km' => ['nullable', 'integer', 'min:0', 'max:9999999'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'block' => $isCreate ? ['sometimes', 'nullable', 'array'] : ['prohibited'],
            'block.starts_at' => ['required_with:block', 'date'],
            'block.ends_at' => ['required_with:block', 'date', 'after:block.starts_at'],
        ];
    }
}
