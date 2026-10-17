<?php

namespace App\Http\Requests\Documents;

use App\Enums\DocumentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Upload multipart. Tipos aceitos: PDF e imagens. O titular (aluno, processo ou veículo) é
 * validado dentro do espaço da rota; ao menos um é obrigatório.
 */
class StoreDocumentRequest extends FormRequest
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
        $organization = $this->route('organization');
        $inOrganization = fn (string $table, bool $softDeletes = false) => tap(
            Rule::exists($table, 'id')->where('organization_id', $organization->getKey()),
            fn ($rule) => $softDeletes ? $rule->whereNull('deleted_at') : $rule,
        );

        return [
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:'.config('autoescola.document_max_kb')],
            'type' => ['required', Rule::enum(DocumentType::class)],
            'student_id' => ['nullable', 'integer', $inOrganization('students', true)],
            'qualification_process_id' => ['nullable', 'integer', $inOrganization('qualification_processes')],
            'vehicle_id' => ['nullable', 'integer', $inOrganization('vehicles', true)],
            'replaces_document_id' => ['nullable', 'integer', $inOrganization('documents')],
            'issuer' => ['nullable', 'string', 'max:150'],
            'issued_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:issued_at'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $owners = array_filter([
                $this->input('student_id'),
                $this->input('qualification_process_id'),
                $this->input('vehicle_id'),
            ]);

            if ($owners === []) {
                $validator->errors()->add('student_id', 'Informe o aluno, o processo ou o veículo a que o documento pertence.');

                return;
            }

            // Processo e aluno informados juntos precisam ser da mesma pessoa.
            if ($this->filled('student_id') && $this->filled('qualification_process_id')) {
                $process = $this->route('organization')->qualificationProcesses()->find($this->input('qualification_process_id'));

                if ($process && $process->student_id !== (int) $this->input('student_id')) {
                    $validator->errors()->add('qualification_process_id', 'O processo não pertence a este aluno.');
                }
            }
        }];
    }

    /**
     * Metadados sem o arquivo.
     *
     * @return array<string, mixed>
     */
    public function metadata(): array
    {
        return collect($this->validated())->except('file')->all();
    }
}
