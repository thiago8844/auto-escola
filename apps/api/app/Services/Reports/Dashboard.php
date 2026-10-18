<?php

namespace App\Services\Reports;

use App\Models\Alert;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\PracticalExam;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Painel inicial com dados reais: aulas de hoje e da semana, alunos em atendimento, pendências, saldo baixo e próximos
 * exames. A equipe vê o espaço inteiro; o instrutor vê só o que é dele.
 */
class Dashboard
{
    /** @return array<string, mixed> */
    public function staff(Organization $org, User $user): array
    {
        $tz = $org->timezone ?: config('autoescola.default_timezone');
        $now = CarbonImmutable::now($tz);
        $dayStart = $now->startOfDay()->utc();
        $dayEnd = $now->endOfDay()->utc();
        $weekStart = $now->startOfWeek()->utc();
        $weekEnd = $now->endOfWeek()->utc();

        $lessons = fn ($from, $to) => Lesson::query()->where('organization_id', $org->getKey())->whereBetween('starts_at', [$from, $to]);
        $count = fn ($q) => $q->selectRaw("COUNT(*) as total, SUM(status='scheduled') as scheduled, SUM(status='completed') as completed, SUM(status='missed') as missed, SUM(status='cancelled') as cancelled")->first();
        $shape = fn ($row) => ['total' => (int) $row->total, 'scheduled' => (int) $row->scheduled, 'completed' => (int) $row->completed, 'missed' => (int) $row->missed, 'cancelled' => (int) $row->cancelled];

        $open = Alert::query()->visibleTo($org, $user)->where('status', 'open')
            ->whereDoesntHave('states', fn ($s) => $s->where('user_id', $user->getKey())->whereNotNull('archived_at'));
        $balanceAlerts = (clone $open)->where('category', 'balance');
        $examsUntil = $now->addDays(13)->endOfDay();
        $upcomingExams = PracticalExam::query()->where('organization_id', $org->getKey())->where('status', 'scheduled')
            ->whereBetween('scheduled_at', [$dayStart, $examsUntil->utc()]);

        return [
            'scope' => 'staff',
            'today' => $shape($count($lessons($dayStart, $dayEnd)->toBase())) + ['date' => $now->toDateString()],
            'week' => $shape($count($lessons($weekStart, $weekEnd)->toBase())) + ['from' => $now->startOfWeek()->toDateString(), 'to' => $now->endOfWeek()->toDateString()],
            'students_in_service' => Enrollment::query()->where('organization_id', $org->getKey())->where('status', 'in_service')->distinct('student_id')->count('student_id'),
            'enrollments_in_service' => Enrollment::query()->where('organization_id', $org->getKey())->where('status', 'in_service')->count(),
            'pending' => [
                'open' => (clone $open)->count(),
                'critical' => (clone $open)->where('priority', 'critical')->count(),
                'high' => (clone $open)->where('priority', 'high')->count(),
            ],
            'low_balance' => ['count' => (clone $balanceAlerts)->count(), 'exhausted' => (clone $balanceAlerts)->where('kind', 'balance.exhausted')->count()],
            'upcoming_exams_total' => (clone $upcomingExams)->count(),
            'upcoming_exams_period' => ['from' => $now->toDateString(), 'to' => $examsUntil->toDateString()],
            'upcoming_exams' => (clone $upcomingExams)
                ->with('student:id,name')->orderBy('scheduled_at')->limit(5)->get()
                ->map(fn ($e) => ['id' => $e->getKey(), 'student' => $e->student?->name, 'category' => $e->category, 'scheduled_at' => $e->scheduled_at->toIso8601String(), 'location' => $e->location])->all(),
            'next_lessons' => Lesson::query()->where('organization_id', $org->getKey())->where('status', 'scheduled')->where('ends_at', '>=', $now->utc())
                ->with(['enrollment.student:id,name', 'instructor:id,full_name', 'vehicle:id,plate'])->orderBy('starts_at')->limit(5)->get()
                ->map(fn ($l) => ['id' => $l->getKey(), 'starts_at' => $l->starts_at->toIso8601String(), 'student' => $l->enrollment?->student?->name, 'instructor' => $l->instructor?->full_name, 'vehicle' => $l->vehicle?->plate])->all(),
        ];
    }

    /** @return array<string, mixed> */
    public function instructor(Organization $org, User $user): array
    {
        $tz = $org->timezone ?: config('autoescola.default_timezone');
        $now = CarbonImmutable::now($tz);
        $instructorId = $user->instructor?->getKey() ?? 0;
        $mine = fn ($from, $to) => Lesson::query()->where('organization_id', $org->getKey())->where('instructor_id', $instructorId)->whereBetween('starts_at', [$from, $to])->whereIn('status', ['scheduled', 'completed']);

        $open = Alert::query()->visibleTo($org, $user)->where('status', 'open')
            ->whereDoesntHave('states', fn ($s) => $s->where('user_id', $user->getKey())->whereNotNull('archived_at'));

        return [
            'scope' => 'instructor',
            'today' => ['total' => $mine($now->startOfDay()->utc(), $now->endOfDay()->utc())->count(), 'date' => $now->toDateString()],
            'week' => ['total' => $mine($now->startOfWeek()->utc(), $now->endOfWeek()->utc())->count()],
            'pending' => ['open' => $open->count()],
        ];
    }
}
