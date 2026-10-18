<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Transferência entre contas do mesmo espaço: débito e crédito vinculados. Não é receita nem despesa.
 */
#[Fillable(['organization_id','from_account_id','to_account_id','amount_cents','occurred_on','reason','created_by','reversed_at','reversed_by','reverse_reason'])]
class FinanceTransfer extends Model
{
    protected $attributes = [];

    protected function casts(): array
    {
        return ['occurred_on'=>'date','reversed_at'=>'datetime'];
    }

    public function fromAccount(): BelongsTo
    {
        return $this->belongsTo(FinanceAccount::class, 'from_account_id');
    }

    public function toAccount(): BelongsTo
    {
        return $this->belongsTo(FinanceAccount::class, 'to_account_id');
    }
}
