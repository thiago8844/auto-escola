<?php

namespace App\Http\Resources;

use App\Models\EnrollmentPackage;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin EnrollmentPackage */
class EnrollmentPackageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'category' => $this->category,
            'description' => $this->description,
            'minutes' => $this->minutes,
            'reference_minutes' => $this->reference_minutes,
            'price_cents' => $this->price_cents,
            'consume_basis' => $this->consume_basis,
            'absence_charge' => $this->absence_charge,
            'late_cancel_charge' => $this->late_cancel_charge,
            'cancel_notice_hours' => $this->cancel_notice_hours,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
