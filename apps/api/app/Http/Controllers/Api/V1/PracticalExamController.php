<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Exams\CorrectExamResult;
use App\Actions\Exams\RecordExamResult;
use App\Actions\Exams\RescheduleExam;
use App\Actions\Exams\ScheduleExam;
use App\Enums\ExamStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Exams\ExamResultRequest;
use App\Http\Requests\Exams\ListExamsRequest;
use App\Http\Requests\Exams\RescheduleExamRequest;
use App\Http\Requests\Exams\StoreExamRequest;
use App\Http\Requests\Exams\UpdateExamRequest;
use App\Http\Resources\PracticalExamResource;
use App\Models\Organization;
use App\Models\PracticalExam;
use App\Services\Audit;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Exames práticos. Equipe: tudo. Instrutor: apenas os exames em que é o responsável,
 * em versão resumida (ver PracticalExamResource).
 */
class PracticalExamController extends Controller
{
    private const STAFF_RELATIONS = [
        'student:id,name', 'vehicle', 'instructor:id,full_name', 'fees.exams:id',
        'process.checklistItems', 'process.externalFees.exams:id',
    ];

    private const LIMITED_RELATIONS = ['student:id,name', 'vehicle', 'instructor:id,full_name'];

    public function index(ListExamsRequest $request, Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [PracticalExam::class, $organization]);

        $staff = $this->isOperator($request);
        $query = $organization->exams()->getQuery();

        if (! $staff) {
            $query->where('instructor_id', $request->user()->instructor?->getKey() ?? 0);
        }

        $timezone = $organization->timezone ?: config('autoescola.default_timezone');
        $filters = $request->validated();

        $exams = $query
            ->with($staff ? self::STAFF_RELATIONS : self::LIMITED_RELATIONS)
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->where('scheduled_at', '>=', CarbonImmutable::parse($from, $timezone)->startOfDay()->utc()))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->where('scheduled_at', '<=', CarbonImmutable::parse($to, $timezone)->endOfDay()->utc()))
            ->when($filters['category'] ?? null, fn ($q, $c) => $q->where('category', $c))
            ->when($filters['status'] ?? null, fn ($q, $s) => $q->where('status', $s))
            ->when($staff && ($filters['student_id'] ?? null), fn ($q, $id) => $q->where('student_id', $id))
            ->when($staff && ($filters['qualification_process_id'] ?? null), fn ($q, $id) => $q->where('qualification_process_id', $id))
            ->when($filters['q'] ?? null, fn ($q, $term) => $q->whereHas('student', fn ($s) => $s->where('name', 'like', '%'.$term.'%')))
            ->orderBy('scheduled_at', $filters['order'] ?? 'desc')
            ->orderByDesc('id')
            ->paginate($this->perPage($request));

        return PracticalExamResource::collection($exams);
    }

    public function store(StoreExamRequest $request, Organization $organization, ScheduleExam $schedule): JsonResponse
    {
        $this->authorize('manage', [PracticalExam::class, $organization]);

        $exam = $schedule($organization, $request->validated());

        return $this->respond($exam, 201);
    }

    public function show(Organization $organization, PracticalExam $exam): JsonResponse
    {
        $this->authorize('view', [$exam, $organization]);

        return $this->respond($exam);
    }

    public function update(UpdateExamRequest $request, Organization $organization, PracticalExam $exam, Audit $audit): JsonResponse
    {
        $this->authorize('manage', [PracticalExam::class, $organization]);

        $exam->fill($request->validated());
        $changes = collect($exam->getDirty())->map(fn ($new, $key) => ['from' => $exam->getOriginal($key), 'to' => $new])->all();
        $exam->save();

        if ($changes !== []) {
            $audit->record($organization->getKey(), 'exam.updated', 'Dados do exame atualizados.', [
                'student_id' => $exam->student_id,
                'process_id' => $exam->qualification_process_id,
                'subject' => $exam,
                'changes' => $changes,
            ]);
        }

        return $this->respond($exam);
    }

    public function reschedule(RescheduleExamRequest $request, Organization $organization, PracticalExam $exam, RescheduleExam $reschedule): JsonResponse
    {
        $this->authorize('manage', [PracticalExam::class, $organization]);

        return $this->respond($reschedule($exam, $request->validated()));
    }

    public function result(ExamResultRequest $request, Organization $organization, PracticalExam $exam, RecordExamResult $record): JsonResponse
    {
        $this->authorize('manage', [PracticalExam::class, $organization]);

        return $this->respond($record($exam, ExamStatus::from($request->validated('status')), $request->validated('reason')));
    }

    public function correct(ExamResultRequest $request, Organization $organization, PracticalExam $exam, CorrectExamResult $correct): JsonResponse
    {
        $this->authorize('correct', [$exam, $organization]);

        $request->validate(['reason' => ['required']]);

        return $this->respond($correct($exam, ExamStatus::from($request->validated('status')), $request->validated('reason')));
    }

    private function respond(PracticalExam $exam, int $status = 200): JsonResponse
    {
        $staff = $this->organizationRole(request())?->canOperate() ?? false;

        $exam->load($staff ? self::STAFF_RELATIONS : self::LIMITED_RELATIONS);

        return (new PracticalExamResource($exam))->response()->setStatusCode($status);
    }
}
