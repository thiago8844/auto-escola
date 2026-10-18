<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Contratação ou acréscimo de minutos. Guarda também a política (consumo, falta, cancelamento)
 * vigente enquanto for o pacote mais recente da matrícula.
 */
#[Fillable([
    'organization_id', 'enrollment_id', 'kind', 'category', 'description', 'minutes', 'reference_minutes',
    'price_cents', 'consume_basis', 'absence_charge', 'late_cancel_charge', 'cancel_notice_hours', 'created_by',
])]
class EnrollmentPackage extends Model
{
    public function enrollment(): BelongsTo
    {
        return $this->belongsTo(Enrollment::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
