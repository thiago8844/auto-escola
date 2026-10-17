<?php

namespace Database\Factories;

use App\Models\Organization;
use App\Models\Partner;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Partner>
 */
class PartnerFactory extends Factory
{
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'name' => fake()->company(),
            'document' => null,
            'email' => null,
            'phone' => null,
        ];
    }
}
