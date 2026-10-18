<?php

namespace App\Services;

use App\Enums\LessonStatus;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\PracticalExam;
use Carbon\CarbonInterface;

/**
 * Lista os compromissos agendados (aulas e exames) de um espaço que ficam afetados por um bloqueio,
 * veículo/instrutor inativado ou validade documental. Só consulta: nunca cancela nem altera nada.
 */
class CommitmentFinder
{
    /**
     * @return list<array<string, mixed>> ordenados por início
     */
    public function find(
        Organization $organization,
        ?int $vehicleId,
        ?int $instructorId,
        CarbonInterface $from,
        ?CarbonInterface $to = null,
    ): array {
        if ($vehicleId === null && $instructorId === null) {
            return [];
        }

        $match = function ($q, string $vehicleColumn = 'vehicle_id') use ($vehicleId, $instructorId) {
            $q->where(function ($w) use ($vehicleId, $instructorId, $vehicleColumn) {
                if ($vehicleId !== null) {
                    $w->orWhere($vehicleColumn, $vehicleId);
                }
                if ($instructorId !== null) {
                    $w->orWhere('instructor_id', $instructorId);
                }
            });
        };

        $lessons = Lesson::query()
            ->where('organization_id', $organization->getKey())
            ->where('status', LessonStatus::Scheduled->value)
            ->where('ends_at', '>', $from)
            ->when($to, fn ($q) => $q->where('starts_at', '<', $to))
            ->tap($match)
            ->with(['enrollment.student:id,name', 'vehicle:id,plate', 'instructor:id,full_name'])
            ->get()
            ->map(fn (Lesson $l) => [
                'type' => 'lesson',
                'id' => $l->getKey(),
                'starts_at' => $l->starts_at->toIso8601String(),
                'ends_at' => $l->ends_at->toIso8601String(),
                'student' => $l->enrollment?->student?->name,
                'enrollment_id' => $l->enrollment_id,
                'vehicle' => $l->vehicle ? ['id' => $l->vehicle->id, 'plate' => $l->vehicle->plate] : null,
                'instructor' => $l->instructor ? ['id' => $l->instructor->id, 'name' => $l->instructor->full_name] : null,
                'affected_by' => $this->reasons($l->vehicle_id, $l->instructor_id, $vehicleId, $instructorId),
            ]);

        $exams = PracticalExam::query()
            ->where('organization_id', $organization->getKey())
            ->where('status', 'scheduled')
            ->whereRaw('DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?', [$from])
            ->when($to, fn ($q) => $q->where('scheduled_at', '<', $to))
            ->tap($match)
            ->with(['student:id,name', 'vehicle:id,plate', 'instructor:id,full_name'])
            ->get()
            ->map(fn (PracticalExam $e) => [
                'type' => 'exam',
                'id' => $e->getKey(),
                'starts_at' => $e->scheduled_at->toIso8601String(),
                'ends_at' => $e->scheduled_at->addMinutes($e->duration_minutes)->toIso8601String(),
                'student' => $e->student?->name,
                'enrollment_id' => $e->enrollment_id,
                'vehicle' => $e->vehicle ? ['id' => $e->vehicle->id, 'plate' => $e->vehicle->plate] : null,
                'instructor' => $e->instructor ? ['id' => $e->instructor->id, 'name' => $e->instructor->full_name] : null,
                'affected_by' => $this->reasons($e->vehicle_id, $e->instructor_id, $vehicleId, $instructorId),
            ]);

        return $lessons->concat($exams)->sortBy('starts_at')->values()->all();
    }

    /**
     * Quantos compromissos de OUTROS espaços o instrutor tem na janela (somente a contagem, sem detalhes).
     */
    public function externalCount(Organization $organization, int $instructorId, CarbonInterface $from, ?CarbonInterface $to): int
    {
        return Lesson::query()
            ->where('organization_id', '!=', $organization->getKey())
            ->where('instructor_id', $instructorId)
            ->where('status', LessonStatus::Scheduled->value)
            ->where('ends_at', '>', $from)
            ->when($to, fn ($q) => $q->where('starts_at', '<', $to))
            ->count()
            + PracticalExam::query()
                ->where('organization_id', '!=', $organization->getKey())
                ->where('instructor_id', $instructorId)
                ->where('status', 'scheduled')
                ->whereRaw('DATE_ADD(scheduled_at, INTERVAL duration_minutes MINUTE) > ?', [$from])
                ->when($to, fn ($q) => $q->where('scheduled_at', '<', $to))
                ->count();
    }

    /** @return list<string> */
    private function reasons(?int $rowVehicle, ?int $rowInstructor, ?int $vehicleId, ?int $instructorId): array
    {
        return array_values(array_filter([
            $vehicleId !== null && $rowVehicle === $vehicleId ? 'vehicle' : null,
            $instructorId !== null && $rowInstructor === $instructorId ? 'instructor' : null,
        ]));
    }
}
