<?php

namespace App\Http\Requests\Processes;

use App\Enums\LicenseCategory;
use App\Enums\ProcessStatus;
use App\Enums\ProcessType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Criação informa aluno e tipo; ambos são imutáveis depois (o checklist depende do tipo).
 * Categorias atuais são obrigatórias para quem já tem habilitação. Nenhuma regra de elegibilidade
 * (idade, tempo de CNH) é aplicada aqui: a elegibilidade oficial não é calculada pelo sistema.
 */
class QualificationProcessRequest extends FormRequest
{
    public const UFS = [
        'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
        'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
    ];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('uf')) {
            $this->merge(['uf' => strtoupper(trim((string) $this->input('uf')))]);
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $isCreate = $this->isMethod('post');
        $required = $isCreate ? 'required' : 'sometimes';
        $organization = $this->route('organization');

        $type = $isCreate
            ? ProcessType::tryFrom((string) $this->input('type'))
            : $this->route('qualification_process')->type;

        return [
            'student_id' => $isCreate
                ? ['required', 'integer', Rule::exists('students', 'id')
                    ->where('organization_id', $organization->getKey())
                    ->whereNull('deleted_at')]
                : ['prohibited'],
            'type' => $isCreate ? ['required', Rule::enum(ProcessType::class)] : ['prohibited'],
            'uf' => [$required, 'string', Rule::in(self::UFS)],
            'municipality' => ['nullable', 'string', 'max:100'],
            'renach' => ['nullable', 'string', 'max:30'],
            'protocol' => ['nullable', 'string', 'max:50'],
            'opened_at' => ['nullable', 'date', 'before_or_equal:today'],
            'current_categories' => [
                $type?->requiresCurrentCategories() ? $required : 'nullable',
                'array',
                $type?->requiresCurrentCategories() ? 'min:1' : 'max:0',
            ],
            'current_categories.*' => ['distinct', Rule::enum(LicenseCategory::class)],
            'target_categories' => [$required, 'array', 'min:1'],
            'target_categories.*' => ['distinct', Rule::enum(LicenseCategory::class)],
            'status' => ['sometimes', Rule::enum(ProcessStatus::class)],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Primeira habilitação não tem categorias atuais: grava lista vazia.
     *
     * @return array<string, mixed>
     */
    public function payload(): array
    {
        $data = $this->validated();

        if ($this->isMethod('post')) {
            $data['current_categories'] ??= [];
        }

        return $data;
    }
}
