<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Bloqueio de agenda de um veículo ou instrutor por período. O histórico é mantido: liberar
 * encerra o bloqueio (`released`), nunca o apaga.
 */
#[Fillable([
    'organization_id', 'resource_type', 'vehicle_id', 'instructor_id', 'scope', 'kind', 'starts_at', 'ends_at',
    'reason', 'status', 'released_at', 'released_by', 'release_note', 'maintenance_id', 'created_by',
])]
class AvailabilityBlock extends Model
{
    public const KINDS = ['maintenance', 'absence', 'vacation', 'other'];

    public const KIND_LABELS = [
        'maintenance' => 'Manutenção',
        'absence' => 'Ausência',
        'vacation' => 'Férias',
        'other' => 'Indisponibilidade',
    ];

    protected $attributes = ['status' => 'active', 'scope' => 'organization'];

    protected function casts(): array
    {
        return ['starts_at' => 'datetime', 'ends_at' => 'datetime', 'released_at' => 'datetime'];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class)->withTrashed();
    }

    public function instructor(): BelongsTo
    {
        return $this->belongsTo(Instructor::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function maintenance(): BelongsTo
    {
        return $this->belongsTo(VehicleMaintenance::class, 'maintenance_id');
    }

    public function isActive(): bool
    {
        return $this->status === 'active';
    }

    public function isPersonal(): bool
    {
        return $this->scope === 'personal';
    }

    /** @param Builder<self> $query */
    public function scopeActive(Builder $query): void
    {
        $query->where('status', 'active');
    }

    /** @param Builder<self> $query */
    public function scopeOverlapping(Builder $query, \DateTimeInterface $start, \DateTimeInterface $end): void
    {
        $query->where('starts_at', '<', $end)->where('ends_at', '>', $start);
    }

    /**
     * Bloqueios que um espaço enxerga: os próprios e as indisponibilidades pessoais dos instrutores vinculados a ele.
     *
     * @param Builder<self> $query
     */
    public function scopeVisibleIn(Builder $query, Organization $organization): void
    {
        $query->where(fn (Builder $q) => $q
            ->where('organization_id', $organization->getKey())
            ->orWhere(fn (Builder $p) => $p->where('scope', 'personal')
                ->whereIn('instructor_id', $organization->instructors()->select('instructors.id'))));
    }
}
