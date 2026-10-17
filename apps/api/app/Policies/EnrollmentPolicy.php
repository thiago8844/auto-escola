<?php

namespace App\Policies;

use App\Models\Enrollment;
use App\Models\Organization;
use App\Models\User;
use App\Services\AssignmentScope;

class EnrollmentPolicy extends OperationalPolicy
{
    public function __construct(private readonly AssignmentScope $scope) {}

    /** Instrutores listam, mas a listagem é filtrada às matrículas atribuídas a eles. */
    public function viewAny(User $user, Organization $organization): bool
    {
        return $this->isMember($user, $organization);
    }

    public function view(User $user, Enrollment $enrollment, Organization $organization): bool
    {
        if ($this->canOperate($user, $organization)) {
            return true;
        }

        $instructor = $this->instructorOf($user, $organization);

        return $instructor !== null && $this->scope->enrollmentIsAssigned($organization, $instructor, $enrollment);
    }

    public function create(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function update(User $user, Enrollment $enrollment, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }
}
