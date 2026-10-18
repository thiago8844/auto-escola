<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Conta bancária ou caixa do espaço. Inativar não apaga o histórico; o saldo inicial não é receita.
 */
#[Fillable(['organization_id','name','kind','institution','identification','opening_balance_cents','opening_date','active','created_by'])]
class FinanceAccount extends Model
{
    protected $attributes = ['active'=>true];

    protected function casts(): array
    {
        return ['opening_date'=>'date','active'=>'boolean','opening_balance_cents'=>'integer'];
    }
}
