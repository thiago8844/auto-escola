<?php

namespace App\Http\Requests\Invitations;

use App\Enums\MembershipRole;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreInvitationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge(['email' => mb_strtolower(trim((string) $this->input('email')))]);
    }

    /**
     * O perfil de instrutor indicado precisa estar vinculado profissionalmente a este espaço.
     * A Action confere se ele ainda não tem conta.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $organization = $this->route('organization');

        return [
            'email' => ['required', 'email', 'max:150'],
            'role' => ['required', Rule::enum(MembershipRole::class)],
            'instructor_id' => [
                'nullable',
                'integer',
                'prohibited_unless:role,instructor',
                Rule::exists('organization_instructor', 'instructor_id')
                    ->where('organization_id', $organization->getKey()),
            ],
        ];
    }
}
