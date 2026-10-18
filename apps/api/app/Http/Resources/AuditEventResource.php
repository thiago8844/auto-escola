<?php

namespace App\Http\Resources;

use App\Models\AuditEvent;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin AuditEvent */
class AuditEventResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'event' => $this->event,
            'category' => $this->category,
            'summary' => $this->summary,
            'reason' => $this->reason,
            'changes' => $this->changes,
            'student_id' => $this->student_id,
            'qualification_process_id' => $this->qualification_process_id,
            'enrollment_id' => $this->enrollment_id,
            'subject' => $this->subject_type ? ['type' => $this->subject_type, 'id' => $this->subject_id] : null,
            'actor' => $this->whenLoaded('actor', fn () => $this->actor ? ['id' => $this->actor->id, 'name' => $this->actor->name] : null),
            'created_at' => $this->created_at->toIso8601String(),
        ];
    }
}
