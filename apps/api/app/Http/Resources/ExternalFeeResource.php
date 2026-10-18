<?php

namespace App\Http\Resources;

use App\Models\ExternalFee;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Taxa externa. `cash_effect` é sempre "none": taxa de órgão externo não é receita do espaço
 * (o reembolso de adiantamento é acertado no financeiro).
 *
 * @mixin ExternalFee
 */
class ExternalFeeResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'qualification_process_id' => $this->qualification_process_id,
            'student_id' => $this->student_id,
            'kind' => $this->kind,
            'voucher_number' => $this->voucher_number,
            'amount_cents' => $this->amount_cents,
            'issued_at' => $this->issued_at?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'reference' => $this->reference,
            'status' => $this->status->value,
            'is_open' => $this->status->isOpen(),
            'status_reason' => $this->status_reason,
            'obligor' => $this->obligor->value,
            'paid_by' => $this->paid_by?->value,
            'reimbursement' => $this->reimbursement,
            'cash_effect' => 'none',
            'confirmed_at' => $this->confirmed_at?->toIso8601String(),
            'confirmed_by' => $this->whenLoaded('confirmer', fn () => $this->confirmer ? ['id' => $this->confirmer->id, 'name' => $this->confirmer->name] : null),
            'receipt_document_id' => $this->receipt_document_id,
            'notes' => $this->notes,
            'exam_ids' => $this->whenLoaded('exams', fn () => $this->exams->pluck('id')->all()),
            'student' => new StudentResource($this->whenLoaded('student')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
