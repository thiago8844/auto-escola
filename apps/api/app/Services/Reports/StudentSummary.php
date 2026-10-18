<?php

namespace App\Services\Reports;

use App\Models\Lesson;
use App\Models\PracticalExam;
use App\Models\Student;
use App\Services\CreditLedger;
use App\Services\ProcessOutcome;

/**
 * Resumo do aluno para atendimento e impressão: contratação e minutos (reservados, realizados, consumidos,
 * disponíveis), faltas, cancelamentos, evolução, exames e situação do processo/emissão.
 */
class StudentSummary
{
    public function __construct(private readonly CreditLedger $ledger, private readonly ProcessOutcome $outcome) {}

    /** @return array<string, mixed> */
    public function for(Student $student, string $timezone): array
    {
        $enrollments = $student->enrollments()->with(['partner:id,name', 'process.checklistItems', 'process.exams', 'process.categoryTracks'])->orderBy('id')->get();
        $balances = $this->ledger->balancesFor($enrollments);

        $lessonRows = Lesson::query()->whereIn('enrollment_id', $enrollments->pluck('id'))->get();
        $exams = PracticalExam::query()->where('student_id', $student->getKey())->orderBy('scheduled_at')->get();

        return [
            'student' => ['id' => $student->getKey(), 'name' => $student->name, 'phone' => $student->phone],
            'enrollments' => $enrollments->map(function ($e) use ($balances, $lessonRows) {
                $mine = $lessonRows->where('enrollment_id', $e->getKey());
                $b = $balances[$e->getKey()];

                return [
                    'id' => $e->getKey(),
                    'category' => $e->category->value,
                    'status' => $e->status->value,
                    'partner' => $e->partner?->name,
                    'price_cents' => $e->price_cents,
                    'minutes' => ['contracted' => $b['contracted'], 'reserved' => $b['reserved'], 'realized' => $b['realized'], 'consumed' => $b['consumed'], 'available' => $b['available']],
                    'lessons' => [
                        'scheduled' => $mine->filter(fn ($l) => $l->status->value === 'scheduled')->count(),
                        'completed' => $mine->filter(fn ($l) => $l->status->value === 'completed')->count(),
                        'missed' => $mine->filter(fn ($l) => $l->status->value === 'missed')->count(),
                        'cancelled' => $mine->filter(fn ($l) => $l->status->value === 'cancelled')->count(),
                    ],
                ];
            })->all(),
            'evolution' => $lessonRows->filter(fn ($l) => $l->status->value === 'completed' && $l->evolution)->sortByDesc('starts_at')->take(10)
                ->map(fn ($l) => ['date' => $l->starts_at->setTimezone($timezone)->toDateString(), 'text' => $l->evolution])->values()->all(),
            'exams' => $exams->map(fn ($x) => [
                'category' => $x->category, 'attempt' => $x->attempt_number, 'status' => $x->status->value,
                'date' => $x->scheduled_at->setTimezone($timezone)->toDateString(), 'location' => $x->location,
            ])->all(),
            'processes' => $enrollments->pluck('process')->filter()->unique('id')->map(function ($p) {
                $outcome = $this->outcome->for($p);

                return [
                    'id' => $p->getKey(), 'type' => $p->type->value, 'status' => $p->status->value,
                    'issuance_status' => $p->issuance_status->value, 'next_step' => $outcome['next_step'] ?? null,
                    'practice_released' => $p->practiceReleased(),
                ];
            })->values()->all(),
        ];
    }
}
