<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Recorrência mensal simples. Cada mês gera no máximo um lançamento (chave `recurrence:ID:AAAA-MM`).
 */
#[Fillable(['organization_id','type','description','category_id','student_id','partner_id','party_id','amount_cents','day_of_month','starts_on','ends_on','active','created_by'])]
class FinanceRecurrence extends Model
{
    protected $attributes = ['active'=>true];

    protected function casts(): array
    {
        return ['starts_on'=>'date','ends_on'=>'date','active'=>'boolean'];
    }
}
