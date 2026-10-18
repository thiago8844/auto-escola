<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Conferência manual do saldo com o extrato externo (sem integração bancária).
 */
#[Fillable(['organization_id','account_id','statement_date','statement_balance_cents','system_balance_cents','difference_cents','notes','created_by'])]
class FinanceReconciliation extends Model
{
    public $timestamps = false;

    protected $attributes = [];

    protected function casts(): array
    {
        return ['statement_date'=>'date','created_at'=>'datetime'];
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(FinanceAccount::class, 'account_id');
    }
}
