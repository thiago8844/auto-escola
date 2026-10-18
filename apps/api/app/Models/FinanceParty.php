<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Favorecido ou fornecedor.
 */
#[Fillable(['organization_id','name','document','email','phone','notes','active'])]
class FinanceParty extends Model
{
    protected $attributes = ['active'=>true];

    protected function casts(): array
    {
        return ['active'=>'boolean'];
    }
}
