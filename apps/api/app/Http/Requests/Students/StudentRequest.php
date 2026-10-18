<?php

namespace App\Http\Requests\Students;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Validation\Rule;

class StudentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('cpf')) {
            $this->merge(['cpf' => preg_replace('/\D/', '', (string) $this->input('cpf'))]);
        }
    }

    /**
     * CPF é único apenas dentro da organização: alunos de CFCs diferentes não são unificados.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $isCreate = $this->isMethod('post');
        $organization = $this->route('organization');
        $student = $this->route('student');

        return [
            'name' => [$isCreate ? 'required' : 'sometimes', 'string', 'max:150'],
            'cpf' => [
                'nullable',
                'size:11',
                Rule::unique('students', 'cpf')
                    ->where('organization_id', $organization->getKey())
                    ->ignore($student?->getKey()),
            ],
            'email' => ['nullable', 'email', 'max:150'],
            'phone' => ['nullable', 'string', 'max:30'],
            'birth_date' => ['nullable', 'date', 'before:today'],
        ];
    }

    /**
     * CPF de aluno arquivado continua reservado: orienta a restaurar em vez de duplicar o cadastro.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            if (! $validator->errors()->has('cpf') || ! $this->filled('cpf')) {
                return;
            }

            $archived = \App\Models\Student::onlyTrashed()
                ->where('organization_id', $this->route('organization')->getKey())
                ->where('cpf', $this->input('cpf'))
                ->exists();

            if ($archived) {
                $validator->errors()->forget('cpf');
                $validator->errors()->add('cpf', 'Este CPF pertence a um aluno arquivado. Restaure o cadastro dele em vez de criar outro.');
            }
        }];
    }
}
