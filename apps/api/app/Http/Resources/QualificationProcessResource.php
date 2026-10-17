<?php

namespace App\Http\Resources;

use App\Models\QualificationProcess;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Processo com resumo de liberação para a prática. O checklist completo vem quando carregado.
 *
 * @mixin QualificationProcess
 */
class QualificationProcessResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'type' => $this->type->value,
            'status' => $this->status->value,
            'uf' => $this->uf,
            'municipality' => $this->municipality,
            'renach' => $this->renach,
            'protocol' => $this->protocol,
            'opened_at' => $this->opened_at?->toDateString(),
            'current_categories' => $this->current_categories,
            'target_categories' => $this->target_categories,
            'notes' => $this->notes,
            'student' => new StudentResource($this->whenLoaded('student')),
            'practice_release' => $this->when($this->relationLoaded('checklistItems'), fn () => PracticeReleaseSummary::of($this->resource)),
            'checklist' => ChecklistItemResource::collection($this->whenLoaded('checklistItems')),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
