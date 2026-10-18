<?php

namespace App\Http\Resources;

use App\Models\AvailabilityBlock;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Bloqueio de agenda. Indisponibilidade pessoal criada em outro espaço aparece só como janela ocupada
 * (sem motivo, tipo, responsável ou nome do espaço), exceto para o próprio instrutor.
 *
 * @mixin AvailabilityBlock
 */
class AvailabilityBlockResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $organization = $request->route('organization');
        $external = $organization !== null && $this->organization_id !== $organization->getKey();
        $ownInstructor = $this->instructor_id !== null && $request->user()?->instructor?->getKey() === $this->instructor_id;
        $detail = ! $external || $ownInstructor;

        return [
            'id' => $this->id,
            'resource_type' => $this->resource_type,
            'scope' => $this->scope,
            'external' => $external,
            'kind' => $detail ? $this->kind : 'other',
            'kind_label' => $detail ? (AvailabilityBlock::KIND_LABELS[$this->kind] ?? $this->kind) : 'Indisponível',
            'starts_at' => $this->starts_at->toIso8601String(),
            'ends_at' => $this->ends_at->toIso8601String(),
            'reason' => $detail ? $this->reason : null,
            'status' => $this->status,
            'released_at' => $this->released_at?->toIso8601String(),
            'release_note' => $detail ? $this->release_note : null,
            'maintenance_id' => $detail ? $this->maintenance_id : null,
            'vehicle' => $this->when($this->relationLoaded('vehicle') && $this->vehicle !== null, fn () => [
                'id' => $this->vehicle->id,
                'plate' => $this->vehicle->plate,
                'model' => $this->vehicle->model,
            ]),
            'instructor' => $this->when($this->relationLoaded('instructor') && $this->instructor !== null, fn () => [
                'id' => $this->instructor->id,
                'full_name' => $this->instructor->full_name,
            ]),
            'created_by' => $detail && $this->relationLoaded('creator') && $this->creator !== null
                ? ['id' => $this->creator->id, 'name' => $this->creator->name]
                : null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
