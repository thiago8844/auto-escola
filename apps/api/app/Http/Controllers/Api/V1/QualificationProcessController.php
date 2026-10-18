<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Processes\CreateQualificationProcess;
use App\Enums\ProcessStatus;
use App\Enums\ProcessType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Processes\QualificationProcessRequest;
use App\Http\Resources\QualificationProcessResource;
use App\Models\Organization;
use App\Models\QualificationProcess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class QualificationProcessController extends Controller
{
    private const RELATIONS = ['student', 'checklistItems.checker', 'exams', 'categoryTracks', 'externalFees.exams', 'enrollments'];

    public function index(Request $request, Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [QualificationProcess::class, $organization]);

        $request->validate([
            'status' => ['nullable', Rule::enum(ProcessStatus::class)],
            'type' => ['nullable', Rule::enum(ProcessType::class)],
            'student_id' => ['nullable', 'integer'],
            'category' => ['nullable', Rule::enum(\App\Enums\LicenseCategory::class)],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $processes = $organization->qualificationProcesses()
            ->with(['student', 'checklistItems'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('type'), fn ($q) => $q->where('type', $request->string('type')))
            ->when($request->filled('student_id'), fn ($q) => $q->where('student_id', $request->integer('student_id')))
            ->when($request->filled('category'), fn ($q) => $q->whereJsonContains('target_categories', $request->string('category')->toString()))
            ->when($request->filled('search'), fn ($q) => $q->whereHas('student', fn ($s) => $s->where('name', 'like', '%'.$request->string('search').'%')))
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return QualificationProcessResource::collection($processes);
    }

    public function store(
        QualificationProcessRequest $request,
        Organization $organization,
        CreateQualificationProcess $create,
    ): JsonResponse {
        $this->authorize('create', [QualificationProcess::class, $organization]);

        $process = $create($organization, $request->payload());

        return (new QualificationProcessResource($process->load(self::RELATIONS)))
            ->response()
            ->setStatusCode(201);
    }

    public function show(Organization $organization, QualificationProcess $qualificationProcess): JsonResponse
    {
        $this->authorize('view', [$qualificationProcess, $organization]);

        return (new QualificationProcessResource($qualificationProcess->load(self::RELATIONS)))->response();
    }

    public function update(
        QualificationProcessRequest $request,
        Organization $organization,
        QualificationProcess $qualificationProcess,
    ): JsonResponse {
        $this->authorize('update', [$qualificationProcess, $organization]);

        app(\App\Services\StaleGuard::class)->assertFresh($qualificationProcess, $request);

        $qualificationProcess->fill($request->payload());
        $changes = collect($qualificationProcess->getDirty())
            ->map(fn ($new, $key) => ['from' => $qualificationProcess->getOriginal($key) instanceof \BackedEnum ? $qualificationProcess->getOriginal($key)->value : $qualificationProcess->getOriginal($key), 'to' => $new instanceof \BackedEnum ? $new->value : $new])
            ->all();
        $qualificationProcess->save();

        if ($changes !== []) {
            app(\App\Services\Audit::class)->record($organization->getKey(), isset($changes['status']) ? 'process.status' : 'process.updated',
                isset($changes['status']) ? "Situação do processo: {$changes['status']['from']} → {$changes['status']['to']}." : 'Dados do processo atualizados.', [
                    'student_id' => $qualificationProcess->student_id,
                    'process_id' => $qualificationProcess->getKey(),
                    'subject' => $qualificationProcess,
                    'changes' => array_diff_key($changes, ['notes' => 1]),
                ]);
        }

        return (new QualificationProcessResource($qualificationProcess->refresh()->load(self::RELATIONS)))->response();
    }
}
