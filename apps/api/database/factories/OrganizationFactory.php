<?php

namespace Database\Factories;

use App\Enums\OrganizationType;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Organization>
 */
class OrganizationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'type' => OrganizationType::Cfc,
            'document' => null,
            'email' => fake()->unique()->companyEmail(),
            'phone' => null,
        ];
    }

    public function independent(): static
    {
        return $this->state(fn () => ['type' => OrganizationType::Independent]);
    }
}
