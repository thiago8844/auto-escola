<?php

namespace App\Http\Requests\Instructors;

use App\Enums\LicenseCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Identidade profissional. Usada na criação (própria conta ou instrutor sem conta)
 * e na edição. Campos de vínculo (ativo, espaço) não passam por aqui.
 */
class InstructorRequest extends FormRequest
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
        $isCreate = $this->isMethod('post');

        return [
            'full_name' => [$isCreate ? 'required' : 'sometimes', 'string', 'max:150'],
            'credential_number' => ['nullable', 'string', 'max:50'],
            // Categorias são opcionais (padrão: lista vazia). Lista vazia é válida.
            'categories' => ['sometimes', 'array'],
            'categories.*' => ['string', Rule::enum(LicenseCategory::class), 'distinct'],
        ];
    }
}
