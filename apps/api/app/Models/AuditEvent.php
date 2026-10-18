<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Evento de auditoria. Append-only.
 */
#[Fillable([
    'organization_id', 'actor_id', 'event', 'category', 'summary', 'reason', 'changes',
    'student_id', 'qualification_process_id', 'enrollment_id', 'subject_type', 'subject_id',
])]
class AuditEvent extends Model
{
    public $timestamps = false;

    protected function casts(): array
    {
        return ['changes' => 'array', 'created_at' => 'datetime'];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
