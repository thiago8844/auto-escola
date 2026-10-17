<?php

namespace App\Http\Resources;

use App\Models\Instructor;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Identidade profissional. Não expõe e-mail ou id da conta de acesso.
 * O campo "active" só aparece quando o vínculo com a organização foi carregado.
 *
 * @mixin Instructor
 */
class InstructorResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'full_name' => $this->full_name,
            'credential_number' => $this->credential_number,
            'categories' => $this->categories,
            'has_account' => $this->user_id !== null,
            'active' => $this->when(isset($this->pivot), fn () => (bool) $this->pivot->active),
        ];
    }
}
