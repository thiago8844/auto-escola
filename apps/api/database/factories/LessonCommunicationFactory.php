<?php

namespace Database\Factories;

use App\Models\Lesson;
use App\Models\LessonCommunication;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<LessonCommunication>
 */
class LessonCommunicationFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'channel' => 'whatsapp_manual',
            'purpose' => 'lesson_confirmation',
            'fingerprint' => hash('sha256', fake()->uuid()),
            'recipient' => '5511999999999',
            'subject' => 'Confirmação de aula prática',
            'body' => 'Sua aula prática está agendada.',
            'status' => 'marked_sent',
            'opened_at' => now(),
            'marked_sent_at' => now(),
        ];
    }

    public function forLesson(Lesson $lesson): static
    {
        return $this->state(fn () => [
            'organization_id' => $lesson->organization_id,
            'lesson_id' => $lesson->getKey(),
            'student_id' => $lesson->enrollment->student_id,
        ]);
    }
}
