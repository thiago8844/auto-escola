<?php

namespace App\Http\Resources;

use App\Models\Lesson;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Aula. Em /me/lessons inclui a organização de origem para o instrutor identificar o espaço.
 *
 * @mixin Lesson
 */
class LessonResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status->value,
            'category' => $this->category,
            'starts_at' => $this->starts_at->toIso8601String(),
            'ends_at' => $this->ends_at->toIso8601String(),
            'scheduled_minutes' => $this->scheduledMinutes(),
            'actual_minutes' => $this->actual_minutes,
            'status_reason' => $this->status_reason,
            'notes' => $this->notes,
            'evolution' => $this->evolution,
            'registry' => [
                'status' => $this->registry_status->value,
                'reference' => $this->registry_reference,
                'document_id' => $this->registry_document_id,
            ],
            'vehicle' => $this->when($this->relationLoaded('vehicle') && $this->vehicle !== null, fn () => [
                'id' => $this->vehicle->id,
                'plate' => $this->vehicle->plate,
                'model' => $this->vehicle->model,
                'category' => $this->vehicle->category->value,
            ]),
            'organization' => $this->when($this->relationLoaded('organization'), fn () => [
                'id' => $this->organization->id,
                'name' => $this->organization->name,
                'type' => $this->organization->type->value,
                'timezone' => $this->organization->timezone,
            ]),
            'instructor' => $this->when($this->relationLoaded('instructor'), fn () => [
                'id' => $this->instructor->id,
                'full_name' => $this->instructor->full_name,
            ]),
            'enrollment' => $this->when($this->relationLoaded('enrollment'), fn () => [
                'id' => $this->enrollment->id,
                'category' => $this->enrollment->category->value,
                'student' => $this->enrollment->relationLoaded('student')
                    ? new StudentResource($this->enrollment->student)
                    : null,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
