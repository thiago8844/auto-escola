<?php

namespace App\Models;

use App\Enums\FeeParty;
use App\Enums\FeeStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * Taxa cobrada por órgão externo. Nunca é receita nem entra no caixa do espaço; o comprovante
 * anexado não confirma o pagamento por si: a confirmação é ato registrado da equipe.
 */
#[Fillable([
    'organization_id', 'qualification_process_id', 'student_id', 'kind', 'voucher_number', 'amount_cents',
    'issued_at', 'due_date', 'reference', 'status', 'obligor', 'paid_by', 'reimbursement', 'status_reason',
    'confirmation_source', 'confirmed_by', 'confirmed_at', 'receipt_document_id', 'notes', 'created_by',
])]
class ExternalFee extends Model
{
    protected $attributes = ['status' => 'unknown', 'obligor' => 'student', 'reimbursement' => 'none'];

    protected function casts(): array
    {
        return [
            'status' => FeeStatus::class,
            'obligor' => FeeParty::class,
            'paid_by' => FeeParty::class,
            'issued_at' => 'date',
            'due_date' => 'date',
            'confirmed_at' => 'datetime',
        ];
    }

    public function exams(): BelongsToMany
    {
        return $this->belongsToMany(PracticalExam::class, 'external_fee_exam');
    }

    public function process(): BelongsTo
    {
        return $this->belongsTo(QualificationProcess::class, 'qualification_process_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function confirmer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'confirmed_by');
    }
}
