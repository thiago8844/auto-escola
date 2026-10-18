<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Movimento do livro-razão da conta. Somente inserção: correções são movimentos opostos.
 */
#[Fillable(['organization_id','account_id','direction','amount_cents','occurred_on','kind','description','payment_id','transfer_id','entry_id','category_id','reverses_movement_id','reconciled_at','created_by'])]
class FinanceMovement extends Model
{
    public $timestamps = false;

    protected $attributes = [];

    protected function casts(): array
    {
        return ['occurred_on'=>'date','reconciled_at'=>'datetime','created_at'=>'datetime','amount_cents'=>'integer'];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(FinanceAccount::class, 'account_id');
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(FinancePayment::class, 'payment_id');
    }

    public function entry(): BelongsTo
    {
        return $this->belongsTo(FinanceEntry::class, 'entry_id');
    }
}
