<?php

namespace App\Actions\Enrollments;

use App\Exceptions\BusinessRuleException;
use App\Models\Enrollment;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;

/**
 * Corrige dados da matrícula por operação explícita, preservando o histórico:
 * - categoria só muda enquanto não há aulas, movimentos de saldo nem exames (senão alteraria o que já foi contratado/feito);
 * - trocar o processo é bloqueado se há exames da matrícula;
 * - toda mudança relevante entra na trilha de auditoria com antes/depois.
 */
class UpdateEnrollment
{
    public function __construct(private readonly Audit $audit) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function __invoke(Enrollment $enrollment, array $data): Enrollment
    {
        return DB::transaction(function () use ($enrollment, $data) {
            $current = Enrollment::query()->whereKey($enrollment->getKey())->lockForUpdate()->firstOrFail();

            if (isset($data['category']) && $data['category'] !== $current->category->value
                && ($current->lessons()->exists() || $current->creditEntries()->exists() || $current->exams()->exists())) {
                throw new BusinessRuleException(
                    'A categoria não pode mudar depois que a matrícula tem aulas, saldo ou exames. Crie uma nova matrícula para a outra categoria.',
                    'enrollment_category_locked',
                    422,
                );
            }

            if (array_key_exists('qualification_process_id', $data)
                && (int) $data['qualification_process_id'] !== (int) $current->qualification_process_id
                && $current->exams()->exists()) {
                throw new BusinessRuleException(
                    'A matrícula tem exames registrados e não pode trocar de processo.',
                    'enrollment_process_locked',
                    422,
                );
            }

            $current->fill($data);
            $dirty = collect($current->getDirty())
                ->map(fn ($new, $key) => ['from' => $current->getOriginal($key), 'to' => $new])
                ->map(fn ($pair) => [
                    'from' => $pair['from'] instanceof \BackedEnum ? $pair['from']->value : $pair['from'],
                    'to' => $pair['to'] instanceof \BackedEnum ? $pair['to']->value : $pair['to'],
                ])
                ->all();

            if ($dirty !== []) {
                $current->save();

                $this->audit->record($current->organization_id, 'enrollment.updated', 'Dados da matrícula alterados: '.implode(', ', array_keys($dirty)).'.', [
                    'enrollment_id' => $current->getKey(),
                    'student_id' => $current->student_id,
                    'process_id' => $current->qualification_process_id,
                    'subject' => $current,
                    'changes' => $dirty,
                ]);
            }

            return $current;
        });
    }
}
