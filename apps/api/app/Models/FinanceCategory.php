<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Categoria simples de receita ou despesa. Repasse/reembolso não conta como faturamento.
 */
#[Fillable(['organization_id','name','type','is_pass_through','active'])]
class FinanceCategory extends Model
{
    protected $attributes = ['active'=>true,'is_pass_through'=>false];

    protected function casts(): array
    {
        return ['is_pass_through'=>'boolean','active'=>'boolean'];
    }
}
