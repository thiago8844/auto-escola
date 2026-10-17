<?php

namespace Database\Factories;

use App\Enums\LicenseCategory;
use App\Models\Enrollment;
use App\Models\Organization;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Atenção: student_id deve pertencer à mesma organização. Informe ambos ao criar.
 *
 * @extends Factory<Enrollment>
 */
class EnrollmentFactory extends Factory
{
    public function definition(): array
    {
        $organization = Organization::factory()->create();

        return [
            'organization_id' => $organization->getKey(),
            'student_id' => Student::factory()->for($organization)->create()->getKey(),
            'partner_id' => null,
            'category' => LicenseCategory::B,
        ];
    }
}
