<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/** Leitura e arquivamento de um alerta por usuário. */
#[Fillable(['alert_id', 'user_id', 'read_at', 'archived_at'])]
class AlertUserState extends Model
{
    protected function casts(): array
    {
        return ['read_at' => 'datetime', 'archived_at' => 'datetime'];
    }
}
