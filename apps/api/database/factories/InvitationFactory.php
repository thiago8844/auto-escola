<?php

namespace Database\Factories;

use App\Enums\MembershipRole;
use App\Models\Invitation;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * Cria convite com token conhecido pelo teste: informe 'token_hash' = hash('sha256', $token).
 *
 * @extends Factory<Invitation>
 */
class InvitationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'email' => fake()->unique()->safeEmail(),
            'role' => MembershipRole::Staff,
            'instructor_id' => null,
            'token_hash' => hash('sha256', Str::random(64)),
            'invited_by_user_id' => User::factory(),
            'expires_at' => now()->addDays(7),
        ];
    }
}
