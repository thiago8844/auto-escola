<?php

namespace App\Http\Resources;

use App\Models\Organization;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin Organization */
class OrganizationResource extends JsonResource
{
    private ?string $explicitRole = null;

    /**
     * Informa o papel do usuário quando ele não vem do pivot nem do middleware
     * (ex.: resposta de criação do espaço).
     */
    public function withRole(string $role): static
    {
        $this->explicitRole = $role;

        return $this;
    }

    /**
     * O papel vem do withRole(), do pivot (listagem de espaços) ou do middleware (espaço da rota).
     *
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $role = $this->explicitRole
            ?? $this->pivot?->role
            ?? $request->attributes->get('organization_role')?->value;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'type' => $this->type,
            'document' => $this->document,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->address,
            'city' => $this->city,
            'state' => $this->state,
            'timezone' => $this->timezone,
            'business_hours' => $this->business_hours,
            'role' => $role,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
