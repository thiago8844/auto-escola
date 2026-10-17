<?php

namespace App\Http\Resources;

use App\Enums\MembershipRole;
use App\Models\Enrollment;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Enrollment */
class EnrollmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $role = $request->attributes->get('organization_role');
        $canSeeFinancial = $role instanceof MembershipRole && $role->canOperate();

        return [
            'id' => $this->id,
            'category' => $this->category->value,
            'status' => $this->status->value,
            'contracted_minutes' => $this->contracted_minutes,
            // Preço e observações do contrato são da equipe de operação.
            'price_cents' => $this->when($canSeeFinancial, $this->price_cents),
            'notes' => $this->when($canSeeFinancial, $this->notes),
            'qualification_process_id' => $this->qualification_process_id,
            'practice_release' => $this->when(
                $this->relationLoaded('process') && $this->process !== null && $this->process->relationLoaded('checklistItems'),
                fn () => PracticeReleaseSummary::of($this->process),
            ),
            'student' => new StudentResource($this->whenLoaded('student')),
            'partner' => $this->when($this->partner_id !== null && $this->relationLoaded('partner'), fn () => new PartnerResource($this->partner)),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
