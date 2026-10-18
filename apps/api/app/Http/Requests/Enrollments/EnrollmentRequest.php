<?php

namespace App\Http\Requests\Enrollments;

use App\Enums\EnrollmentStatus;
use App\Enums\LicenseCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Criação informa o aluno. Na atualização o aluno é imutável: troque a matrícula, não a pessoa.
 * Parceiro e categoria são validados contra a organização da rota.
 */
class EnrollmentRequest extends FormRequest
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
        $organization = $this->route('organization');

        return [
            'student_id' => $isCreate
                ? ['required', 'integer', Rule::exists('students', 'id')
                    ->where('organization_id', $organization->getKey())
                    ->whereNull('deleted_at')]
                : ['prohibited'],
            'partner_id' => ['nullable', 'integer', Rule::exists('partners', 'id')
                ->where('organization_id', $organization->getKey())
                ->whereNull('deleted_at')],
            'category' => [$isCreate ? 'required' : 'sometimes', Rule::enum(LicenseCategory::class)],
            'qualification_process_id' => ['nullable', 'integer', Rule::exists('qualification_processes', 'id')
                ->where('organization_id', $organization->getKey())],
            'status' => ['sometimes', Rule::enum(EnrollmentStatus::class)],
            // Serviço contratado em minutos: não presume "hora" nem "hora-aula".
            // Depois de criada, a contratação só muda por acréscimo/ajuste no extrato de saldo.
            'contracted_minutes' => $isCreate ? ['nullable', 'integer', 'min:1', 'max:100000'] : ['prohibited'],
            'price_cents' => $isCreate ? ['nullable', 'integer', 'min:0'] : ['prohibited'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * O processo precisa ser do mesmo aluno e cobrir a categoria da matrícula.
     *
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator) {
            if (! $this->filled('qualification_process_id') || $validator->errors()->isNotEmpty()) {
                return;
            }

            $enrollment = $this->route('enrollment');
            $studentId = $enrollment?->student_id ?? $this->integer('student_id');
            $category = LicenseCategory::tryFrom((string) $this->input('category', $enrollment?->category?->value));
            $process = $this->route('organization')->qualificationProcesses()->find($this->input('qualification_process_id'));

            if ($process === null) {
                return;
            }

            if ($process->student_id !== $studentId) {
                $validator->errors()->add('qualification_process_id', 'O processo pertence a outro aluno.');

                return;
            }

            $covered = collect($process->targetCategoryEnums())
                ->flatMap(fn (LicenseCategory $c) => $c->components())
                ->map->value->all();
            $needed = collect($category?->components() ?? [])->map->value->all();

            if (array_diff($needed, $covered) !== []) {
                $validator->errors()->add('category', 'A categoria da matrícula não está entre as categorias pretendidas do processo.');
            }
        }];
    }
}
