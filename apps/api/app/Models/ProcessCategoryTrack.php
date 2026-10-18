<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

/**
 * Situação manual de uma categoria simples no processo (renúncia e sua confirmação, separadas).
 */
#[Fillable([
    'organization_id', 'qualification_process_id', 'category', 'renounced_at', 'renunciation_reason',
    'renunciation_confirmed_at', 'renunciation_reference',
])]
class ProcessCategoryTrack extends Model
{
    protected function casts(): array
    {
        return ['renounced_at' => 'datetime', 'renunciation_confirmed_at' => 'datetime'];
    }
}
