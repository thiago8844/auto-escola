<?php

namespace App\Models;

use App\Enums\LicenseCategory;
use App\Enums\VehicleStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Veículo de instrução de uma organização. A categoria é simples (A, B, C, D, E ou ACC).
 */
#[Fillable([
    'organization_id', 'plate', 'brand', 'model', 'year', 'category', 'adapted',
    'adaptations', 'crlv_expires_at', 'status', 'notes',
])]
class Vehicle extends Model
{
    use HasFactory, SoftDeletes;

    protected $attributes = [
        'status' => 'active',
        'adapted' => false,
    ];

    protected function casts(): array
    {
        return [
            'category' => LicenseCategory::class,
            'status' => VehicleStatus::class,
            'adapted' => 'boolean',
            'crlv_expires_at' => 'date',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(Lesson::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }
}
