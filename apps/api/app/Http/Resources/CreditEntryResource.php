<?php

namespace App\Http\Resources;

use App\Models\CreditEntry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin CreditEntry */
class CreditEntryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'bucket' => $this->bucket->value,
            'type' => $this->type->value,
            'type_label' => $this->type->label(),
            'category' => $this->category,
            'minutes' => $this->minutes,
            'reason' => $this->reason,
            'lesson_id' => $this->lesson_id,
            'package_id' => $this->package_id,
            'reverses_entry_id' => $this->reverses_entry_id,
            'actor' => $this->whenLoaded('actor', fn () => $this->actor ? ['id' => $this->actor->id, 'name' => $this->actor->name] : null),
            'occurred_at' => $this->occurred_at->toIso8601String(),
        ];
    }
}
