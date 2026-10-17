<?php

namespace App\Http\Requests\Processes;

use App\Enums\ChecklistItemStatus;
use App\Enums\ChecklistItemType;
use App\Enums\ChecklistSource;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * POST acrescenta uma exigência ao processo (sempre obrigatória). PATCH atualiza a situação.
 * `required` não é editável: a equipe pode acrescentar exigências, nunca ocultá-las.
 * O documento anexado precisa pertencer ao mesmo processo/aluno; anexar não conclui o item.
 */
class ChecklistItemRequest extends FormRequest
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
        $process = $this->route('qualification_process');
        $isCreate = $this->isMethod('post');

        return [
            'type' => $isCreate
                ? ['required', Rule::enum(ChecklistItemType::class),
                    Rule::unique('process_checklist_items', 'type')->where('qualification_process_id', $process->getKey())]
                : ['prohibited'],
            'required' => ['prohibited'],
            'status' => [$isCreate ? 'sometimes' : 'required_without_all:source,reference,notes,occurred_on,document_id',
                Rule::enum(ChecklistItemStatus::class)],
            'source' => ['nullable', Rule::enum(ChecklistSource::class)],
            'reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'occurred_on' => ['nullable', 'date'],
            'document_id' => ['nullable', 'integer', Rule::exists('documents', 'id')
                ->where('organization_id', $organization->getKey())],
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            $documentId = $this->input('document_id');

            if (! $documentId || $validator->errors()->isNotEmpty()) {
                return;
            }

            $process = $this->route('qualification_process');
            $document = $this->route('organization')->documents()->find($documentId);

            $foreignProcess = $document?->qualification_process_id !== null
                && $document->qualification_process_id !== $process->getKey();
            $foreignStudent = $document?->student_id !== null
                && $document->student_id !== $process->student_id;

            if ($foreignProcess || $foreignStudent) {
                $validator->errors()->add('document_id', 'O documento não pertence a este processo ou aluno.');
            }
        }];
    }
}
