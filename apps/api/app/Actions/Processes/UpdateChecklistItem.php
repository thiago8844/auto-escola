<?php

namespace App\Actions\Processes;

use App\Enums\ChecklistItemStatus;
use App\Enums\ChecklistSource;
use App\Exceptions\BusinessRuleException;
use App\Models\ProcessChecklistItem;
use App\Models\User;

/**
 * Atualiza um item do checklist.
 *
 * - "Conferido" (verified) exige origem que não seja a mera declaração do aluno e registra
 *   quem conferiu e quando. Sair de "conferido" limpa essa marca.
 * - "Não aplicável" e "bloqueado" exigem motivo em `notes`: não existe dispensa sem justificativa.
 * - O campo `required` não é editável: a equipe pode acrescentar exigências, nunca ocultá-las.
 */
class UpdateChecklistItem
{
    /**
     * @param  array<string, mixed>  $data  status, source, reference, notes, occurred_on, document_id
     */
    public function __invoke(ProcessChecklistItem $item, User $user, array $data): ProcessChecklistItem
    {
        $item->fill($data);

        if ($item->status->requiresReason() && blank($item->notes)) {
            throw new BusinessRuleException(
                'Informe o motivo em "notes" para marcar o item como não aplicável ou bloqueado.',
                'reason_required',
                422,
            );
        }

        if ($item->status === ChecklistItemStatus::Verified) {
            $trustedSources = [ChecklistSource::Document, ChecklistSource::OfficialSystem, ChecklistSource::Imported];

            if (! in_array($item->source, $trustedSources, true)) {
                throw new BusinessRuleException(
                    'Para conferir o item informe a origem (documento, sistema oficial ou importação); a declaração do aluno não basta.',
                    'verification_source_required',
                    422,
                );
            }

            if ($item->isDirty('status') || $item->checked_by === null) {
                $item->checked_by = $user->getKey();
                $item->checked_at = now();
            }
        } else {
            $item->checked_by = null;
            $item->checked_at = null;
        }

        $changes = collect($item->getDirty())->only(['status', 'source', 'reference'])
            ->map(fn ($new, $key) => ['from' => $item->getOriginal($key) instanceof \BackedEnum ? $item->getOriginal($key)->value : $item->getOriginal($key), 'to' => $new instanceof \BackedEnum ? $new->value : $new])
            ->all();
        $item->save();

        if ($changes !== []) {
            $process = $item->process()->first();
            app(\App\Services\Audit::class)->record($item->organization_id, 'process.checklist', "Checklist de liberação: {$item->type->value} atualizado.", [
                'actor_id' => $user->getKey(),
                'student_id' => $process?->student_id,
                'process_id' => $item->qualification_process_id,
                'subject' => $item,
                'changes' => $changes,
            ]);
        }

        return $item;
    }
}
