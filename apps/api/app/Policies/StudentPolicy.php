<?php

namespace App\Policies;

use App\Models\Organization;
use App\Models\Student;
use App\Models\User;
use App\Services\AssignmentScope;

class StudentPolicy extends OperationalPolicy
{
    public function __construct(private readonly AssignmentScope $scope) {}

    /** Instrutores também listam, mas a listagem é filtrada às matrículas atribuídas a eles. */
    public function viewAny(User $user, Organization $organization): bool
    {
        return $this->isMember($user, $organization);
    }

    public function view(User $user, Student $student, Organization $organization): bool
    {
        if ($this->canOperate($user, $organization)) {
            return true;
        }

        $instructor = $this->instructorOf($user, $organization);

        return $instructor !== null && $this->scope->studentIsAssigned($organization, $instructor, $student);
    }

    public function create(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function update(User $user, Student $student, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function delete(User $user, Student $student, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }
}
