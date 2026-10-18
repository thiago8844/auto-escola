<?php

namespace App\Services;

use App\Models\Lesson;

class LessonMessageComposer
{
    /** @return array{subject: string, body: string} */
    public function compose(Lesson $lesson): array
    {
        $organization = $lesson->organization;
        $student = $lesson->enrollment->student;
        $timezone = $organization->timezone ?: config('autoescola.default_timezone');
        $startsAt = $lesson->starts_at->setTimezone($timezone);
        $endsAt = $lesson->ends_at->setTimezone($timezone);
        $date = $startsAt->format('d/m/Y');
        $start = $startsAt->format('H:i');
        $end = $endsAt->format('H:i');

        return [
            'subject' => "Confirmação de aula prática em {$date}",
            'body' => "Olá, {$student->name}!\n\nSua aula prática está agendada para {$date}, das {$start} às {$end} (horário de {$timezone}).\nInstrutor: {$lesson->instructor->full_name}.\nAutoescola: {$organization->name}.\n\nSe precisar remarcar, entre em contato com a autoescola.",
        ];
    }
}
