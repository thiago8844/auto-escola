<?php

namespace App\Http\Resources;

use App\Models\Document;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Metadados do documento. O caminho em disco nunca é exposto; o arquivo só sai pelo
 * endpoint autenticado de download.
 *
 * @mixin Document
 */
class DocumentResource extends JsonResource
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
            'student_id' => $this->student_id,
            'qualification_process_id' => $this->qualification_process_id,
            'vehicle_id' => $this->vehicle_id,
            'practical_exam_id' => $this->practical_exam_id,
            'replaces_document_id' => $this->replaces_document_id,
            'version' => $this->version,
            'issuer' => $this->issuer,
            'issued_at' => $this->issued_at?->toDateString(),
            'expires_at' => $this->expires_at?->toDateString(),
            'notes' => $this->notes,
            'original_name' => $this->original_name,
            'mime_type' => $this->mime_type,
            'size' => $this->size,
            'uploaded_by' => $this->uploaded_by,
            'verified_by' => $this->verified_by,
            'verified_at' => $this->verified_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
