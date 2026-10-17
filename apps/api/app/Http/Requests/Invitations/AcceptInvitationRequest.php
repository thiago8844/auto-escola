<?php

namespace App\Http\Requests\Invitations;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Aceite recebe apenas o token. Nenhuma identidade (nome, CPF, e-mail) é aceita no payload.
 */
class AcceptInvitationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'token' => ['required', 'string', 'size:64'],
        ];
    }
}
