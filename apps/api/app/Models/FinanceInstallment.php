<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Parcela com vencimento, situação e pagamentos próprios.
 */
#[Fillable(['organization_id','entry_id','number','due_date','amount_cents','paid_cents','status','paid_on'])]
class FinanceInstallment extends Model
{
    protected $attributes = ['status'=>'open','paid_cents'=>0];

    protected function casts(): array
    {
        return ['due_date'=>'date','paid_on'=>'date','amount_cents'=>'integer','paid_cents'=>'integer'];
    }

    public function entry(): BelongsTo
    {
        return $this->belongsTo(FinanceEntry::class, 'entry_id');
    }

    public function payments(): HasMany
    {
        return $this->hasMany(FinancePayment::class, 'installment_id')->orderBy('id');
    }

    public function outstandingCents(): int
    {
        return $this->status === 'cancelled' ? 0 : max($this->amount_cents - $this->paid_cents, 0);
    }
}
