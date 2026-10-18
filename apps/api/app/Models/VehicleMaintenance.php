<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Manutenção de um veículo. `finance_ref` é a referência única que o financeiro (módulo 8) usará
 * para gerar uma única conta a pagar.
 */
#[Fillable([
    'organization_id', 'vehicle_id', 'type', 'status', 'scheduled_on', 'performed_on', 'provider', 'odometer_km',
    'estimated_cost_cents', 'actual_cost_cents', 'document_id', 'next_due_date', 'next_due_km', 'notes',
    'finance_ref', 'created_by', 'completed_by',
])]
class VehicleMaintenance extends Model
{
    protected $attributes = ['status' => 'scheduled'];

    protected function casts(): array
    {
        return ['scheduled_on' => 'date', 'performed_on' => 'date', 'next_due_date' => 'date'];
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class)->withTrashed();
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function block(): HasOne
    {
        return $this->hasOne(AvailabilityBlock::class, 'maintenance_id');
    }
}
