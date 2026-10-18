<?php

namespace App\Http\Resources;

use App\Models\Alert;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Alerta com o estado de leitura do usuário atual (carregado em `user_state`).
 *
 * @mixin Alert
 */
class AlertResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $state = $this->relationLoaded('states') ? $this->states->first() : null;

        return [
            'id' => $this->id,
            'kind' => $this->kind,
            'category' => $this->category,
            'priority' => $this->priority,
            'title' => $this->title,
            'message' => $this->message,
            'subject' => $this->subject_type ? ['type' => $this->subject_type, 'id' => $this->subject_id] : null,
            'due_on' => $this->due_on?->toDateString(),
            'status' => $this->status,
            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'resolved_reason' => $this->resolved_reason,
            'first_seen_at' => $this->first_seen_at->toIso8601String(),
            'read_at' => $state?->read_at?->toIso8601String(),
            'archived_at' => $state?->archived_at?->toIso8601String(),
        ];
    }
}
