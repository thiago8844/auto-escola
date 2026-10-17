<?php

namespace Database\Factories;

use App\Enums\LicenseCategory;
use App\Enums\ProcessStatus;
use App\Enums\ProcessType;
use App\Models\Organization;
use App\Models\QualificationProcess;
use App\Models\Student;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Cria o processo SEM checklist. Para o fluxo completo use a action CreateQualificationProcess
 * ou o endpoint. Informe organization_id e student_id da mesma organização.
 *
 * @extends Factory<QualificationProcess>
 */
class QualificationProcessFactory extends Factory
{
    public function definition(): array
    {
        $organization = Organization::factory()->create();

        return [
            'organization_id' => $organization->getKey(),
            'student_id' => Student::factory()->for($organization)->create()->getKey(),
            'type' => ProcessType::FirstLicense,
            'uf' => 'MG',
            'municipality' => 'Belo Horizonte',
            'renach' => null,
            'protocol' => null,
            'opened_at' => '2026-09-01',
            'current_categories' => [],
            'target_categories' => [LicenseCategory::B->value],
            'status' => ProcessStatus::Active,
            'notes' => null,
        ];
    }
}
