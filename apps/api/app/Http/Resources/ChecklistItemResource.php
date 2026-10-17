<?php

namespace App\Http\Resources;

use App\Models\ProcessChecklistItem;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin ProcessChecklistItem */
class ChecklistItemResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'required' => $this->required,
            'status' => $this->status->value,
            'source' => $this->source?->value,
            'reference' => $this->reference,
            'notes' => $this->notes,
            'occurred_on' => $this->occurred_on?->toDateString(),
            'document_id' => $this->document_id,
            'checked_by' => $this->when($this->checked_by !== null && $this->relationLoaded('checker'), fn () => [
                'id' => $this->checker->id,
                'name' => $this->checker->name,
            ]),
            'checked_at' => $this->checked_at?->toIso8601String(),
        ];
    }
}
