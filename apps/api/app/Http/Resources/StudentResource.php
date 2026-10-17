<?php

namespace App\Http\Resources;

use App\Enums\MembershipRole;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Nome e telefone são sempre expostos. CPF, e-mail e data de nascimento só aparecem
 * para a equipe de operação do espaço (owner, admin, staff). Qualquer outro contexto,
 * incluindo /me/lessons, recebe a versão restrita.
 *
 * @mixin Student
 */
class StudentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $role = $request->attributes->get('organization_role');
        $canSeeSensitive = $role instanceof MembershipRole && $role->canOperate();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'phone' => $this->phone,
            'cpf' => $this->when($canSeeSensitive, $this->cpf),
            'email' => $this->when($canSeeSensitive, $this->email),
            'birth_date' => $this->when($canSeeSensitive, $this->birth_date?->toDateString()),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
