<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Availability\SaveAvailabilityBlock;
use App\Http\Controllers\Controller;
use App\Http\Requests\Availability\BlockRequest;
use App\Http\Resources\AvailabilityBlockResource;
use App\Models\AvailabilityBlock;
use App\Models\Organization;
use App\Services\CommitmentFinder;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Bloqueios de agenda de veículos e instrutores. Criar, alterar e liberar devolvem os compromissos
 * afetados em `meta.affected`; nenhum compromisso é cancelado automaticamente.
 */
class AvailabilityBlockController extends Controller
{
    private const RELATIONS = ['vehicle:id,plate,model', 'instructor:id,full_name', 'creator:id,name'];

    public function index(Request $request, Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [AvailabilityBlock::class, $organization]);

        $request->validate([
            'resource_type' => ['nullable', Rule::in(['vehicle', 'instructor'])],
            'vehicle_id' => ['nullable', 'integer'],
            'instructor_id' => ['nullable', 'integer'],
            'status' => ['nullable', Rule::in(['active', 'released'])],
            'current' => ['nullable', 'boolean'],
        ]);

        $query = AvailabilityBlock::query()->visibleIn($organization)->with(self::RELATIONS);

        if (! $this->isOperator($request)) {
            $query->where('instructor_id', $request->user()->instructor?->getKey() ?? 0);
        }

        $blocks = $query
            ->when($request->filled('resource_type'), fn ($q) => $q->where('resource_type', $request->string('resource_type')))
            ->when($request->filled('vehicle_id'), fn ($q) => $q->where('vehicle_id', $request->integer('vehicle_id')))
            ->when($request->filled('instructor_id'), fn ($q) => $q->where('instructor_id', $request->integer('instructor_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->boolean('current'), fn ($q) => $q->where('status', 'active')->where('ends_at', '>', now()))
            ->orderBy('starts_at')
            ->paginate($this->perPage($request));

        return AvailabilityBlockResource::collection($blocks);
    }

    public function store(BlockRequest $request, Organization $organization, SaveAvailabilityBlock $save): JsonResponse
    {
        $data = $request->validated();
        $this->authorize('create', [AvailabilityBlock::class, $organization, $data]);

        return $this->respond($save->create($organization, $data), 201);
    }

    public function update(BlockRequest $request, Organization $organization, AvailabilityBlock $availabilityBlock, SaveAvailabilityBlock $save): JsonResponse
    {
        $this->authorize('change', [$availabilityBlock, $organization]);

        return $this->respond($save->update($availabilityBlock, $request->validated()));
    }

    public function release(Request $request, Organization $organization, AvailabilityBlock $availabilityBlock, SaveAvailabilityBlock $save): JsonResponse
    {
        $this->authorize('change', [$availabilityBlock, $organization]);

        $request->validate(['note' => ['nullable', 'string', 'max:255']]);

        $block = $save->release($availabilityBlock, $request->input('note'));

        return (new AvailabilityBlockResource($block->load(self::RELATIONS)))->response();
    }

    /**
     * Prévia: quais compromissos um bloqueio nesse período afetaria. Não grava nada.
     */
    public function impact(Request $request, Organization $organization, CommitmentFinder $finder): JsonResponse
    {
        $this->authorize('operate', [AvailabilityBlock::class, $organization]);

        $data = $request->validate([
            'vehicle_id' => ['nullable', 'integer', 'required_without:instructor_id'],
            'instructor_id' => ['nullable', 'integer', 'required_without:vehicle_id'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
        ]);

        $affected = $finder->find(
            $organization,
            $data['vehicle_id'] ?? null,
            $data['instructor_id'] ?? null,
            CarbonImmutable::parse($data['starts_at']),
            CarbonImmutable::parse($data['ends_at']),
        );

        return response()->json(['data' => $affected, 'meta' => ['count' => count($affected)]]);
    }

    /**
     * @param  array{block: AvailabilityBlock, affected: list<array<string, mixed>>, external_affected: int}  $result
     */
    private function respond(array $result, int $status = 200): JsonResponse
    {
        return (new AvailabilityBlockResource($result['block']->load(self::RELATIONS)))
            ->additional(['meta' => ['affected' => $result['affected'], 'external_affected' => $result['external_affected']]])
            ->response()
            ->setStatusCode($status);
    }
}
