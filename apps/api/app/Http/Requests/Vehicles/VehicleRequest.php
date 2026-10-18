<?php

namespace App\Http\Requests\Vehicles;

use App\Enums\LicenseCategory;
use App\Enums\VehicleStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Validation\Rule;

class VehicleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('plate')) {
            $this->merge(['plate' => strtoupper(preg_replace('/[^A-Za-z0-9]/', '', (string) $this->input('plate')))]);
        }
    }

    /**
     * Placa única no espaço (formatos antigo e Mercosul têm 7 caracteres). A categoria é
     * sempre simples: um veículo B atende matrículas B e AB, nunca "AB".
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $isCreate = $this->isMethod('post');
        $required = $isCreate ? 'required' : 'sometimes';
        $organization = $this->route('organization');

        return [
            'plate' => [$required, 'string', 'size:7', 'alpha_num',
                Rule::unique('vehicles', 'plate')
                    ->where('organization_id', $organization->getKey())
                    ->ignore($this->route('vehicle')?->getKey())],
            'brand' => ['nullable', 'string', 'max:60'],
            'model' => [$required, 'string', 'max:80'],
            'year' => ['nullable', 'integer', 'between:1950,'.((int) date('Y') + 1)],
            'category' => [$required, Rule::in(LicenseCategory::simpleValues())],
            'adapted' => ['sometimes', 'boolean'],
            'adaptations' => ['nullable', 'string', 'max:2000'],
            'crlv_expires_at' => ['nullable', 'date'],
            'status' => ['sometimes', Rule::enum(VehicleStatus::class)],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Placa de veículo arquivado continua reservada: orienta a restaurar o cadastro.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            if (! $validator->errors()->has('plate') || ! $this->filled('plate')) {
                return;
            }

            $archived = \App\Models\Vehicle::onlyTrashed()
                ->where('organization_id', $this->route('organization')->getKey())
                ->where('plate', $this->input('plate'))
                ->exists();

            if ($archived) {
                $validator->errors()->forget('plate');
                $validator->errors()->add('plate', 'Esta placa pertence a um veículo arquivado. Restaure o cadastro dele em vez de criar outro.');
            }
        }];
    }
}
