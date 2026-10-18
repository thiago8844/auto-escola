<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Baixa de uma parcela (total, parcial ou dividida). Estornar não apaga: cria movimentos opostos.
 */
#[Fillable(['organization_id','installment_id','account_id','method_id','status','paid_on','expected_on','settled_on','applied_cents','discount_cents','interest_cents','fine_cents','fee_cents','adjust_reason','reference','notes','client_ref','created_by','confirmed_by','reversed_at','reversed_by','reverse_reason'])]
class FinancePayment extends Model
{
    protected $attributes = ['discount_cents'=>0,'interest_cents'=>0,'fine_cents'=>0,'fee_cents'=>0];

    protected function casts(): array
    {
        return ['paid_on'=>'date','expected_on'=>'date','settled_on'=>'date','reversed_at'=>'datetime'];
    }

    public function installment(): BelongsTo
    {
        return $this->belongsTo(FinanceInstallment::class, 'installment_id');
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(FinanceAccount::class, 'account_id');
    }

    public function method(): BelongsTo
    {
        return $this->belongsTo(FinancePaymentMethod::class, 'method_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function movements(): HasMany
    {
        return $this->hasMany(FinanceMovement::class, 'payment_id');
    }

    /** Valor que entra/sai de fato na conta, antes da taxa: valor aplicado + juros + multa. */
    public function grossCents(): int
    {
        return $this->applied_cents + $this->interest_cents + $this->fine_cents;
    }
}
