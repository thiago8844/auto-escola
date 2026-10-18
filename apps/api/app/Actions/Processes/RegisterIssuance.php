<?php

namespace App\Actions\Processes;

use App\Enums\IssuanceStatus;
use App\Enums\ProcessStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\QualificationProcess;
use App\Services\Audit;
use App\Services\ProcessOutcome;
use Illuminate\Support\Facades\DB;

/**
 * Acompanha a emissão do documento (PPD ou CNH): pendente → emitido → entregue. Só existe
 * quando alguma categoria foi aprovada. Voltar uma etapa é correção e exige motivo.
 */
class RegisterIssuance
{
    private const ORDER = ['not_started' => 0, 'pending' => 1, 'issued' => 2, 'delivered' => 3];

    public function __construct(private readonly Audit $audit, private readonly ProcessOutcome $outcome) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function __invoke(QualificationProcess $process, array $data): QualificationProcess
    {
        return DB::transaction(function () use ($process, $data) {
            $current = QualificationProcess::query()->whereKey($process->getKey())->lockForUpdate()->firstOrFail();
            $next = IssuanceStatus::from($data['status']);
            $previous = $current->issuance_status;

            if (! collect($this->outcome->categories($current->load(['exams', 'categoryTracks'])))->contains('result', 'approved')) {
                throw new BusinessRuleException('A emissão só é acompanhada depois da aprovação em alguma categoria.', 'no_approved_category', 422);
            }

            if (in_array($current->status, [ProcessStatus::Completed, ProcessStatus::Closed], true)) {
                throw new BusinessRuleException('O processo está encerrado. Reabra-o para alterar a emissão.', 'process_closed', 422);
            }

            $regress = self::ORDER[$next->value] < self::ORDER[$previous->value];
            if ($regress && empty($data['reason'])) {
                throw new BusinessRuleException('Informe o motivo para voltar a situação da emissão.', 'reason_required', 422);
            }

            $kind = $data['kind'] ?? $current->issuance_kind;
            $reference = $data['reference'] ?? $current->issuance_reference;
            $documentId = $data['document_id'] ?? $current->issuance_document_id;
            $issuedAt = $data['issued_at'] ?? $current->issued_at?->toDateString();

            if (in_array($next, [IssuanceStatus::Issued, IssuanceStatus::Delivered], true)) {
                if ($kind === null || $issuedAt === null || ($reference === null && $documentId === null)) {
                    throw new BusinessRuleException(
                        'Para registrar emissão informe o tipo (PPD/CNH), a data e a referência ou evidência anexada.',
                        'issuance_evidence_required',
                        422,
                    );
                }
            }

            if ($next === IssuanceStatus::Delivered && empty($data['delivered_at'])) {
                throw new BusinessRuleException('Informe a data da entrega.', 'delivery_date_required', 422);
            }

            $current->forceFill([
                'issuance_status' => $next,
                'issuance_kind' => $kind,
                'issuance_reference' => $reference,
                'issuance_document_id' => $documentId,
                'issued_at' => $next === IssuanceStatus::Pending ? null : $issuedAt,
                'delivered_at' => $next === IssuanceStatus::Delivered ? $data['delivered_at'] : null,
                'definitive_follow_up' => $data['definitive_follow_up'] ?? $current->definitive_follow_up,
                'definitive_due_at' => array_key_exists('definitive_due_at', $data) ? $data['definitive_due_at'] : $current->definitive_due_at,
            ]);

            if ($next === IssuanceStatus::Pending && $current->status === ProcessStatus::Active) {
                $current->status = ProcessStatus::AwaitingIssuance;
            }

            $current->save();

            $this->audit->record($current->organization_id, 'process.issuance', "Emissão do documento: {$previous->value} → {$next->value}.", [
                'student_id' => $current->student_id,
                'process_id' => $current->getKey(),
                'subject' => $current,
                'reason' => $data['reason'] ?? null,
                'changes' => ['issuance_status' => ['from' => $previous->value, 'to' => $next->value], 'kind' => $kind, 'reference' => $reference],
            ]);

            return $current;
        });
    }
}
