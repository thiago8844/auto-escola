<?php

namespace App\Models;

use App\Enums\LessonStatus;
use App\Enums\RegistryStatus;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Aula de uma matrícula, atribuída a um instrutor. Existe uma única vez, na
 * organização que a criou; instrutores a veem na agenda pessoal, sem cópia.
 */
#[Fillable([
    'organization_id', 'enrollment_id', 'instructor_id', 'vehicle_id', 'category', 'starts_at', 'ends_at',
    'actual_minutes', 'status', 'status_reason', 'notes', 'evolution',
    'registry_status', 'registry_reference', 'registry_document_id',
])]
class Lesson extends Model
{
    use HasFactory;

    /** Defaults espelhando o banco, para que modelos recém-criados já venham completos. */
    protected $attributes = [
        'registry_status' => 'not_informed',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'status' => LessonStatus::class,
            'registry_status' => RegistryStatus::class,
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function instructor(): BelongsTo
    {
        return $this->belongsTo(Instructor::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    /**
     * Duração agendada, em minutos.
     */
    public function scheduledMinutes(): int
    {
        return (int) $this->starts_at->diffInMinutes($this->ends_at);
    }

    /**
     * Filtros de agenda: período, status, instrutor, veículo e matrícula.
     *
     * `from`/`to` são DIAS no fuso informado (o do espaço, ou o padrão da aplicação); os
     * limites são convertidos para UTC antes de consultar, já que as aulas ficam em UTC.
     *
     * @param  array<string, mixed>  $filters
     */
    public function scopeFilter(Builder $query, array $filters, ?string $timezone = null): void
    {
        $timezone ??= config('autoescola.default_timezone');

        $query
            ->when($filters['from'] ?? null, fn (Builder $q, $from) => $q->where('starts_at', '>=', CarbonImmutable::parse($from, $timezone)->startOfDay()->utc()))
            ->when($filters['to'] ?? null, fn (Builder $q, $to) => $q->where('starts_at', '<=', CarbonImmutable::parse($to, $timezone)->endOfDay()->utc()))
            ->when($filters['vehicle_id'] ?? null, fn (Builder $q, $id) => $q->where('vehicle_id', $id))
            ->when($filters['status'] ?? null, fn (Builder $q, $status) => $q->where('status', $status))
            ->when($filters['instructor_id'] ?? null, fn (Builder $q, $id) => $q->where('instructor_id', $id))
            ->when($filters['enrollment_id'] ?? null, fn (Builder $q, $id) => $q->where('enrollment_id', $id));
    }
}
