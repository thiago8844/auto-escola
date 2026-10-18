<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Availability\SaveAvailabilityBlock;
use App\Http\Controllers\Controller;
use App\Http\Requests\Availability\WeeklyHoursRequest;
use App\Http\Resources\AvailabilityBlockResource;
use App\Http\Resources\DocumentResource;
use App\Http\Resources\InstructorResource;
use App\Http\Resources\VehicleMaintenanceResource;
use App\Http\Resources\VehicleResource;
use App\Models\AvailabilityBlock;
use App\Models\Document;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\Vehicle;
use App\Services\Audit;
use App\Services\CommitmentFinder;
use App\Services\MaintenanceDue;
use App\Services\WorkingHours;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Visões consolidadas: detalhe do veículo (documentos, bloqueios, manutenções e compromissos afetados)
 * e disponibilidade do instrutor (regra de horário, bloqueios e próximos compromissos).
 */
class FleetOverviewController extends Controller
{
    public function vehicle(Request $request, Organization $organization, Vehicle $vehicle, CommitmentFinder $finder, MaintenanceDue $due): JsonResponse
    {
        $this->authorize('operate', [AvailabilityBlock::class, $organization]);

        $timezone = $organization->timezone ?: config('autoescola.default_timezone');
        $today = now()->setTimezone($timezone)->toDateString();

        $blocks = AvailabilityBlock::query()->where('vehicle_id', $vehicle->getKey())
            ->with('creator:id,name')->orderByDesc('starts_at')->limit(30)->get();
        $activeBlocks = $blocks->filter(fn ($b) => $b->isActive() && $b->ends_at > now());

        $commitments = collect($finder->find($organization, $vehicle->getKey(), null, now()))
            ->map(function (array $c) use ($vehicle, $activeBlocks, $timezone) {
                $start = \Carbon\CarbonImmutable::parse($c['starts_at']);
                $end = \Carbon\CarbonImmutable::parse($c['ends_at']);
                $issues = [];

                if ($activeBlocks->contains(fn ($b) => $b->starts_at < $end && $b->ends_at > $start)) {
                    $issues[] = 'blocked';
                }
                if ($vehicle->crlv_expires_at !== null && $vehicle->crlv_expires_at->toDateString() < $start->setTimezone($timezone)->toDateString()) {
                    $issues[] = 'crlv_expired';
                }
                if ($vehicle->status->value !== 'active') {
                    $issues[] = 'inactive';
                }

                return $c + ['issues' => $issues];
            })->values();

        return response()->json(['data' => [
            'vehicle' => (new VehicleResource($vehicle))->resolve($request),
            'documents' => DocumentResource::collection(
                Document::query()->where('organization_id', $organization->getKey())->where('vehicle_id', $vehicle->getKey())
                    ->orderByDesc('type')->orderByDesc('version')->limit(50)->get(),
            )->resolve($request),
            'blocks' => AvailabilityBlockResource::collection($blocks)->resolve($request),
            'maintenances' => VehicleMaintenanceResource::collection(
                $vehicle->maintenances()->with('block')->orderByDesc('scheduled_on')->orderByDesc('id')->limit(30)->get(),
            )->resolve($request),
            'maintenance_due' => $due->forVehicle($vehicle, $today)->map(fn ($row) => [
                'state' => $row['state'],
                'reasons' => $row['reasons'],
                'maintenance' => (new VehicleMaintenanceResource($row['maintenance']))->resolve($request),
            ])->all(),
            'commitments' => $commitments->all(),
            'affected_count' => $commitments->filter(fn ($c) => $c['issues'] !== [])->count(),
        ]]);
    }

    public function vehicleCommitments(Request $request, Organization $organization, Vehicle $vehicle, CommitmentFinder $finder): JsonResponse
    {
        $this->authorize('operate', [AvailabilityBlock::class, $organization]);

        return response()->json(['data' => $finder->find($organization, $vehicle->getKey(), null, now())]);
    }

    public function instructor(Request $request, Organization $organization, Instructor $instructor, CommitmentFinder $finder): JsonResponse
    {
        $this->authorizeInstructorView($request, $organization, $instructor);

        $link = $organization->instructors()->whereKey($instructor->getKey())->firstOrFail();
        $weekly = $link->pivot->weekly_hours ? json_decode($link->pivot->weekly_hours, true) : null;
        $operator = $this->isOperator($request);

        $blocks = AvailabilityBlock::query()->visibleIn($organization)
            ->where('instructor_id', $instructor->getKey())
            ->where('status', 'active')->where('ends_at', '>', now())
            ->with('creator:id,name')->orderBy('starts_at')->limit(50)->get();

        $upcoming = $finder->find($organization, null, $instructor->getKey(), now());

        return response()->json(['data' => [
            'instructor' => (new InstructorResource($link))->resolve($request),
            'rule' => [
                'mode' => ($organization->business_hours !== null || $weekly !== null) ? 'restricted' : 'free',
                'business_hours' => $organization->business_hours,
                'weekly_hours' => $weekly,
            ],
            'blocks' => AvailabilityBlockResource::collection($blocks)->resolve($request),
            'upcoming_count' => count($upcoming),
            'upcoming' => $operator ? array_slice($upcoming, 0, 30) : [],
        ]]);
    }

    public function updateWeeklyHours(WeeklyHoursRequest $request, Organization $organization, Instructor $instructor, WorkingHours $hours, Audit $audit): JsonResponse
    {
        $this->authorize('operate', [AvailabilityBlock::class, $organization]);

        $organization->instructors()->whereKey($instructor->getKey())->firstOrFail();
        $normalized = $hours->normalize($request->validated('weekly_hours'));

        $organization->instructors()->updateExistingPivot($instructor->getKey(), [
            'weekly_hours' => $normalized === null ? null : json_encode($normalized),
        ]);

        $audit->record($organization->getKey(), 'availability.hours', "Horário semanal de {$instructor->full_name} atualizado.", [
            'changes' => ['instructor_id' => $instructor->getKey(), 'weekly_hours' => $normalized],
        ]);

        return response()->json(['data' => ['weekly_hours' => $normalized]]);
    }

    public function instructorCommitments(Request $request, Organization $organization, Instructor $instructor, CommitmentFinder $finder): JsonResponse
    {
        $this->authorize('operate', [AvailabilityBlock::class, $organization]);

        $organization->instructors()->whereKey($instructor->getKey())->firstOrFail();

        return response()->json(['data' => $finder->find($organization, null, $instructor->getKey(), now())]);
    }

    private function authorizeInstructorView(Request $request, Organization $organization, Instructor $instructor): void
    {
        if ($this->isOperator($request)) {
            return;
        }

        abort_unless($request->user()->instructor?->getKey() === $instructor->getKey(), 403);
    }
}
