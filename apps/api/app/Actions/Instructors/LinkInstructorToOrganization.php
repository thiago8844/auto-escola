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

            return;
        }

        $organization->instructors()->attach($instructor->getKey(), ['active' => $active]);
    }
}
