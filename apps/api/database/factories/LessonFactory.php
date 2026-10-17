<?php

namespace Database\Factories;

use App\Enums\LessonStatus;
use App\Models\Enrollment;
use App\Models\Instructor;
use App\Models\Lesson;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * Atenção: a aula precisa de organization_id, enrollment e instrutor da mesma organização
 * (com vínculo profissional). Prefira criar via ScheduleLesson em testes de regra.
 *
 * @extends Factory<Lesson>
 */
class LessonFactory extends Factory
{
    public function definition(): array
    {
        $enrollment = Enrollment::factory()->create();

        return [
            'organization_id' => $enrollment->organization_id,
            'enrollment_id' => $enrollment->getKey(),
            'instructor_id' => Instructor::factory()->create()->getKey(),
            'starts_at' => now()->addDays(2)->setTime(9, 0),
            'ends_at' => now()->addDays(2)->setTime(10, 0),
            'status' => LessonStatus::Scheduled,
            'notes' => null,
        ];
    }
}
