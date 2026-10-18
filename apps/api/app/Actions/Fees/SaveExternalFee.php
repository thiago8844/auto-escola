<?php

namespace App\Actions\Fees;

use App\Enums\FeeParty;
use App\Enums\FeeStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\ExternalFee;
use App\Models\Organization;
use App\Models\PracticalExam;
use App\Models\QualificationProcess;
use App\Services\Audit;
use Illuminate\Support\Facades\DB;

/**
 * Cria/edita uma taxa externa. A taxa é um registro único por processo; pode estar ligada a
 * várias tentativas (taxa compartilhada) sem ser contada duas vezes. Trocar o status é outra operação.
 */
class SaveExternalFee
{
    public function __construct(private readonly Audit $audit) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(Organization $organization, array $data): ExternalFee
    {
        return DB::transaction(function () use ($organization, $data) {
            $process = QualificationProcess::query()->where('organization_id', $organization->getKey())
                ->findOrFail($data['qualification_process_id']);

            $examIds = $data['exam_ids'] ?? [];
            $this->assertExamsBelong($process, $examIds);

            $fee = ExternalFee::create(collect($data)->except('exam_ids', 'status')->all() + [
                'organization_id' => $organization->getKey(),
                'student_id' => $process->student_id,
                'status' => FeeStatus::Unknown,
                'created_by' => auth()->id(),
            ]);
            $fee->exams()->sync($examIds);

            $this->audit->record($organization->getKey(), 'fee.created', "Taxa externa registrada: {$fee->kind}.", [
                'student_id' => $process->student_id,
                'process_id' => $process->getKey(),
                'subject' => $fee,
                'changes' => ['amount_cents' => $fee->amount_cents, 'voucher_number' => $fee->voucher_number, 'due_date' => $fee->due_date?->toDateString()],
            ]);

            return $fee;
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(ExternalFee $fee, array $data): ExternalFee
    {
        return DB::transaction(function () use ($fee, $data) {
            $current = ExternalFee::query()->whereKey($fee->getKey())->lockForUpdate()->firstOrFail();

            if (in_array($current->status, [FeeStatus::Confirmed, FeeStatus::Cancelled], true)
                && (array_key_exists('amount_cents', $data) || array_key_exists('voucher_number', $data))) {
                throw new BusinessRuleException(
                    'Taxa confirmada ou cancelada não tem guia nem valor alterados. Cancele-a e registre outra.',
                    'fee_locked',
                    422,
                );
            }

            if (array_key_exists('exam_ids', $data)) {
                $this->assertExamsBelong($current->process, $data['exam_ids']);
                $current->exams()->sync($data['exam_ids']);
            }

            $current->fill(collect($data)->except('exam_ids', 'status')->all());
            $changes = collect($current->getDirty())->map(fn ($new, $key) => ['from' => $current->getOriginal($key), 'to' => $new])->all();
            $current->save();

            if ($changes !== [] || array_key_exists('exam_ids', $data)) {
                $this->audit->record($current->organization_id, 'fee.updated', "Taxa externa atualizada: {$current->kind}.", [
                    'student_id' => $current->student_id,
                    'process_id' => $current->qualification_process_id,
                    'subject' => $current,
                    'changes' => collect($changes)->map(fn ($c) => [
                        'from' => $c['from'] instanceof \BackedEnum ? $c['from']->value : $c['from'],
                        'to' => $c['to'] instanceof \BackedEnum ? $c['to']->value : $c['to'],
                    ])->all(),
                ]);
            }

            return $current;
        });
    }

    /**
     * Muda a situação com as evidências exigidas. Anexar comprovante nunca confirma sozinho:
     * a confirmação registra quem conferiu, quando e a fonte.
     */
    public function changeStatus(ExternalFee $fee, FeeStatus $next, ?string $reason, ?string $source, ?FeeParty $paidBy): ExternalFee
    {
        return DB::transaction(function () use ($fee, $next, $reason, $source, $paidBy) {
            $current = ExternalFee::query()->whereKey($fee->getKey())->lockForUpdate()->firstOrFail();
            $previous = $current->status;

            if ($previous === FeeStatus::Cancelled) {
                throw new BusinessRuleException('Taxa cancelada não muda de situação.', 'invalid_status_transition', 422);
            }

            $changes = ['status' => $next, 'status_reason' => $reason];

            switch ($next) {
                case FeeStatus::Confirmed:
                    if ($source === null || trim($source) === '') {
                        throw new BusinessRuleException('Informe a fonte da confirmação (ex.: consulta ao órgão, extrato).', 'confirmation_source_required', 422);
                    }
                    if ($paidBy === null && $current->paid_by === null) {
                        throw new BusinessRuleException('Informe quem efetivamente pagou.', 'paid_by_required', 422);
                    }
                    $changes += ['confirmation_source' => $source, 'confirmed_by' => auth()->id(), 'confirmed_at' => now()];
                    break;
                case FeeStatus::Waived:
                case FeeStatus::Cancelled:
                    if ($reason === null || trim($reason) === '') {
                        throw new BusinessRuleException('Informe o motivo.', 'reason_required', 422);
                    }
                    break;
                default:
                    break;
            }

            if ($next !== FeeStatus::Confirmed && $previous === FeeStatus::Confirmed) {
                $changes += ['confirmation_source' => null, 'confirmed_by' => null, 'confirmed_at' => null];
            }

            if ($paidBy !== null) {
                $changes['paid_by'] = $paidBy;
            }

            $current->forceFill($changes);

            // Quem pagou foi o espaço por conta de outra pessoa: adiantamento a acertar.
            $effectivePayer = $changes['paid_by'] ?? $current->paid_by;
            if ($next === FeeStatus::Confirmed && $effectivePayer === FeeParty::Organization && $current->obligor !== FeeParty::Organization) {
                $current->reimbursement = 'to_settle';
            } elseif (in_array($next, [FeeStatus::Cancelled, FeeStatus::Waived], true)) {
                $current->reimbursement = 'none';
            }

            $current->save();

            $this->audit->record($current->organization_id, 'fee.'.$next->value, "Taxa externa ({$current->kind}): {$previous->value} → {$next->value}.", [
                'student_id' => $current->student_id,
                'process_id' => $current->qualification_process_id,
                'subject' => $current,
                'reason' => $reason,
                'changes' => ['status' => ['from' => $previous->value, 'to' => $next->value], 'source' => $source],
            ]);

            return $current;
        });
    }

    public function settleReimbursement(ExternalFee $fee): ExternalFee
    {
        return DB::transaction(function () use ($fee) {
            $current = ExternalFee::query()->whereKey($fee->getKey())->lockForUpdate()->firstOrFail();

            if ($current->reimbursement !== 'to_settle') {
                throw new BusinessRuleException('Esta taxa não tem reembolso a acertar.', 'no_reimbursement_due', 422);
            }

            $current->forceFill(['reimbursement' => 'settled'])->save();

            $this->audit->record($current->organization_id, 'fee.reimbursed', "Reembolso da taxa ({$current->kind}) acertado.", [
                'student_id' => $current->student_id,
                'process_id' => $current->qualification_process_id,
                'subject' => $current,
            ]);

            return $current;
        });
    }

    /**
     * @param  list<int>  $examIds
     */
    private function assertExamsBelong(QualificationProcess $process, array $examIds): void
    {
        if ($examIds === []) {
            return;
        }

        $count = PracticalExam::query()
            ->where('qualification_process_id', $process->getKey())
            ->whereIn('id', $examIds)
            ->count();

        if ($count !== count(array_unique($examIds))) {
            throw new BusinessRuleException('Há exames que não pertencem a este processo.', 'fee_exam_invalid', 422);
        }
    }
}
