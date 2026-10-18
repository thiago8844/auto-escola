<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Forma de pagamento. Com dias de liquidação > 0 (cartão, boleto) a entrada só vale ao ser confirmada.
 */
#[Fillable(['organization_id','name','kind','settlement_days','active'])]
class FinancePaymentMethod extends Model
{
    protected $attributes = ['active'=>true,'settlement_days'=>0];

    protected function casts(): array
    {
        return ['active'=>'boolean'];
    }
}
