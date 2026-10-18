<?php

namespace App\Services;

use App\Models\Enrollment;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\Student;
use Illuminate\Database\Eloquent\Builder;

/**
 * Restringe a visão de instrutores aos registros necessários aos seus atendimentos.
 *
 * Um aluno ou matrícula é visível ao instrutor se houver encaminhamento ativo ou aula dele
 * (em qualquer status) naquela organização. Não remove o isolamento entre organizações:
 * todas as consultas partem de $organization.
 */
class AssignmentScope
{
    /**
     * @return Builder<Student>
     */
    public function studentsFor(Organization $organization, Instructor $instructor): Builder
    {
        return $organization->students()->getQuery()->whereHas('enrollments', fn (Builder $q) => $q
            ->where(fn (Builder $assigned) => $assigned
                ->where('assigned_instructor_id', $instructor->getKey())
                ->orWhereHas('lessons', fn (Builder $l) => $l->where('instructor_id', $instructor->getKey()))));
    }

    /**
     * @return Builder<Enrollment>
     */
    public function enrollmentsFor(Organization $organization, Instructor $instructor): Builder
    {
        return $organization->enrollments()->getQuery()->where(fn (Builder $assigned) => $assigned
            ->where('assigned_instructor_id', $instructor->getKey())
            ->orWhereHas('lessons', fn (Builder $l) => $l->where('instructor_id', $instructor->getKey())));
    }

    public function studentIsAssigned(Organization $organization, Instructor $instructor, Student $student): bool
    {
        return $this->studentsFor($organization, $instructor)->whereKey($student->getKey())->exists();
    }

    public function enrollmentIsAssigned(Organization $organization, Instructor $instructor, Enrollment $enrollment): bool
    {
        return $this->enrollmentsFor($organization, $instructor)->whereKey($enrollment->getKey())->exists();
    }
}
