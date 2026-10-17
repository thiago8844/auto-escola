<?php

namespace Database\Factories;

use App\Enums\LicenseCategory;
use App\Enums\VehicleStatus;
use App\Models\Organization;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Vehicle>
 */
class VehicleFactory extends Factory
{
    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'plate' => strtoupper(fake()->unique()->bothify('???#?##')),
            'brand' => 'Fiat',
            'model' => 'Argo',
            'year' => 2023,
            'category' => LicenseCategory::B,
            'adapted' => false,
            'adaptations' => null,
            'crlv_expires_at' => now()->addYear()->toDateString(),
            'status' => VehicleStatus::Active,
            'notes' => null,
        ];
    }

    public function category(LicenseCategory $category): static
    {
        return $this->state(fn () => ['category' => $category]);
    }
}
