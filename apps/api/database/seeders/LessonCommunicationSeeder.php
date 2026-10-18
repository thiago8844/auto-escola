<?php

namespace Database\Seeders;

use App\Models\Lesson;
use App\Models\LessonCommunication;
use Illuminate\Database\Seeder;

class LessonCommunicationSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $lesson = Lesson::query()->whereHas('enrollment.student')->first();

        if ($lesson !== null) {
            LessonCommunication::factory()->forLesson($lesson)->create();
        }
    }
}
