<?php

namespace App\Models;

use App\Enums\ChecklistItemStatus;
use App\Enums\ChecklistItemType;
use App\Enums\ChecklistSource;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Item do checklist de liberação para a prática.
 */
#[Fillable([
    'organization_id', 'qualification_process_id', 'type', 'required', 'status', 'source',
    'reference', 'notes', 'occurred_on', 'document_id', 'checked_by', 'checked_at',
])]
class ProcessChecklistItem extends Model
{
    use HasFactory;

    protected $attributes = [
        'status' => 'pending',
        'required' => true,
    ];

    protected function casts(): array
    {
        return [
            'type' => ChecklistItemType::class,
            'status' => ChecklistItemStatus::class,
            'source' => ChecklistSource::class,
            'required' => 'boolean',
            'occurred_on' => 'date',
            'checked_at' => 'datetime',
        ];
    }

    public function process(): BelongsTo
    {
        return $this->belongsTo(QualificationProcess::class, 'qualification_process_id');
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function checker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'checked_by');
    }
}
