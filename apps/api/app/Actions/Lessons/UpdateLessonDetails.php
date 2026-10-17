<?php

namespace App\Actions\Lessons;

use App\Enums\LessonStatus;
use App\Exceptions\BusinessRuleException;
use App\Models\Lesson;

/**
 * Ajusta observações, evolução pedagógica e duração real. Evolução e duração real só
 * existem em aula realizada.
 */
class UpdateLessonDetails
{
    /**
     * @param  array{notes?: ?string, evolution?: ?string, actual_minutes?: ?int}  $data
     */
    public function __invoke(Lesson $lesson, array $data): Lesson
    {
        $touchesExecution = array_key_exists('evolution', $data) || array_key_exists('actual_minutes', $data);

        if ($touchesExecution && $lesson->status !== LessonStatus::Completed) {
            throw new BusinessRuleException(
                'Evolução e duração real só podem ser registradas em aulas realizadas.',
                'lesson_not_completed',
                422,
            );
        }

        $lesson->forceFill($data)->save();

        return $lesson;
    }
}
