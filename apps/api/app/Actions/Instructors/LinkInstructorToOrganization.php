<?php

namespace App\Actions\Instructors;

use App\Models\Instructor;
use App\Models\Organization;

/**
 * Garante vínculo profissional ativo entre instrutor e organização (organization_instructor).
 * Não altera a identidade global do instrutor.
 */
class LinkInstructorToOrganization
{
    public function __invoke(Organization $organization, Instructor $instructor, bool $active = true): void
    {
        $existing = $organization->instructors()->whereKey($instructor->getKey())->exists();

        if ($existing) {
            $organization->instructors()->updateExistingPivot($instructor->getKey(), ['active' => $active]);
        } else {
            $organization->instructors()->attach($instructor->getKey(), ['active' => $active]);
        }

        app(\App\Services\Audit::class)->record($organization->getKey(), 'access.instructor_link',
            "Vínculo do instrutor {$instructor->full_name}: ".($active ? 'ativo' : 'inativo').'.', [
                'changes' => ['instructor_id' => $instructor->getKey(), 'active' => $active],
            ]);
    }
}
