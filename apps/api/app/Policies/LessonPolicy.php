<?php

namespace App\Policies;

use App\Enums\LessonStatus;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\User;

/**
 * Aulas. Equipe e instrutor agendam, remarcam e cancelam; o instrutor atua somente
 * nas próprias aulas. Trocar o instrutor de uma aula e o registro oficial são da equipe.
 */
class LessonPolicy extends OperationalPolicy
{
    public function viewAny(User $user, Organization $organization): bool
    {
        return $this->isMember($user, $organization);
    }

    public function view(User $user, Lesson $lesson, Organization $organization): bool
    {
        if ($this->canOperate($user, $organization)) {
            return true;
        }

        return $this->isOwnLesson($user, $lesson, $organization);
    }

    /** Equipe, ou instrutor com perfil no espaço (o controller restringe a aulas dele). */
    public function create(User $user, Organization $organization): bool
    {
        return $this->canOperate($user, $organization) || $this->instructorOf($user, $organization) !== null;
    }

    public function reschedule(User $user, Lesson $lesson, Organization $organization): bool
    {
        return $this->canOperate($user, $organization) || $this->isOwnLesson($user, $lesson, $organization);
    }

    /** Troca de veículo (e de instrutor, só pela equipe): o controller barra a troca de instrutor. */
    public function reassign(User $user, Lesson $lesson, Organization $organization): bool
    {
        return $this->canOperate($user, $organization) || $this->isOwnLesson($user, $lesson, $organization);
    }

    /** Observações, evolução e duração real: equipe ou o instrutor da própria aula. */
    public function update(User $user, Lesson $lesson, Organization $organization): bool
    {
        return $this->canOperate($user, $organization) || $this->isOwnLesson($user, $lesson, $organization);
    }

    /** Registro oficial da aula: apenas a equipe de operação. */
    public function registry(User $user, Lesson $lesson, Organization $organization): bool
    {
        return $this->canOperate($user, $organization);
    }

    public function updateStatus(User $user, Lesson $lesson, Organization $organization, LessonStatus $next): bool
    {
        if ($this->canOperate($user, $organization)) {
            return true;
        }

        return $this->isOwnLesson($user, $lesson, $organization)
            && in_array($next, [LessonStatus::Completed, LessonStatus::Missed, LessonStatus::Cancelled], true);
    }

    private function isOwnLesson(User $user, Lesson $lesson, Organization $organization): bool
    {
        $instructor = $this->instructorOf($user, $organization);

        return $instructor !== null && $lesson->instructor_id === $instructor->getKey();
    }
}
