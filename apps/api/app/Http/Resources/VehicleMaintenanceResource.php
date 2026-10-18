<?php

namespace App\Http\Resources;

use App\Models\VehicleMaintenance;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin VehicleMaintenance */
class VehicleMaintenanceResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'vehicle_id' => $this->vehicle_id,
            'vehicle' => $this->when($this->relationLoaded('vehicle') && $this->vehicle !== null, fn () => [
                'id' => $this->vehicle->id,
                'plate' => $this->vehicle->plate,
                'model' => $this->vehicle->model,
            ]),
            'type' => $this->type,
            'status' => $this->status,
            'scheduled_on' => $this->scheduled_on->toDateString(),
            'performed_on' => $this->performed_on?->toDateString(),
            'provider' => $this->provider,
            'odometer_km' => $this->odometer_km,
            'estimated_cost_cents' => $this->estimated_cost_cents,
            'actual_cost_cents' => $this->actual_cost_cents,
            'document_id' => $this->document_id,
            'next_due_date' => $this->next_due_date?->toDateString(),
            'next_due_km' => $this->next_due_km,
            'notes' => $this->notes,
            'finance_ref' => $this->finance_ref,
            'block' => $this->when($this->relationLoaded('block') && $this->block !== null, fn () => [
                'id' => $this->block->id,
                'starts_at' => $this->block->starts_at->toIso8601String(),
                'ends_at' => $this->block->ends_at->toIso8601String(),
                'status' => $this->block->status,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
