<?php

namespace App\Models;

use App\Enums\CreditBucket;
use App\Enums\CreditEntryType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Movimento do extrato de minutos. Append-only: sem updated_at e sem edição.
 */
#[Fillable([
    'organization_id', 'enrollment_id', 'package_id', 'lesson_id', 'reverses_entry_id', 'bucket', 'type',
    'category', 'minutes', 'reason', 'dedupe_key', 'actor_id', 'occurred_at',
])]
class CreditEntry extends Model
{
    protected $table = 'enrollment_credit_entries';

    public $timestamps = false;

    protected function casts(): array
    {
        return [
            'bucket' => CreditBucket::class,
            'type' => CreditEntryType::class,
            'minutes' => 'integer',
            'occurred_at' => 'datetime',
        ];
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function lesson(): BelongsTo
    {
        return $this->belongsTo(Lesson::class);
    }
}
