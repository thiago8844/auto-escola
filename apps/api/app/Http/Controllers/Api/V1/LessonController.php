<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Lessons\ChangeLessonStatus;
use App\Actions\Lessons\RescheduleLesson;
use App\Actions\Lessons\ScheduleLesson;
use App\Actions\Lessons\SetLessonRegistry;
use App\Actions\Lessons\UpdateLessonDetails;
use App\Enums\LessonStatus;
use App\Enums\RegistryStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Lessons\LessonRegistryRequest;
use App\Http\Requests\Lessons\ListLessonsRequest;
use App\Http\Requests\Lessons\RescheduleLessonRequest;
use App\Http\Requests\Lessons\StoreLessonRequest;
use App\Http\Requests\Lessons\UpdateLessonRequest;
use App\Http\Requests\Lessons\UpdateLessonStatusRequest;
use App\Http\Resources\LessonResource;
use App\Models\Lesson;
use App\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class LessonController extends Controller
{
    private const RELATIONS = ['organization:id,name,type', 'instructor:id,full_name', 'vehicle', 'enrollment.student'];

    public function index(ListLessonsRequest $request, Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [Lesson::class, $organization]);

        $query = $organization->lessons()->with(self::RELATIONS);
        $filters = $request->validated();

        if (! $this->isOperator($request)) {
            // Instrutor vê apenas as próprias aulas nesta organização. O filtro por
            // instrutor é ignorado para não permitir listar a agenda de colegas.
            $instructor = $request->user()->instructor;
            $query->where('instructor_id', $instructor?->getKey() ?? 0);
            unset($filters['instructor_id']);
        }

        $lessons = $query
            ->filter($filters, $organization->timezone)
            ->orderBy('starts_at')
            ->paginate($this->perPage($request));

        return LessonResource::collection($lessons);
    }

    public function store(StoreLessonRequest $request, Organization $organization, ScheduleLesson $schedule): JsonResponse
    {
        $this->authorize('create', [Lesson::class, $organization]);

        $enrollment = $organization->enrollments()->whereKey($request->integer('enrollment_id'))->firstOrFail();

        $lesson = $schedule(
            $organization,
            $enrollment,
            $request->integer('instructor_id'),
            CarbonImmutable::parse($request->string('starts_at')->toString()),
            CarbonImmutable::parse($request->string('ends_at')->toString()),
            $request->validated('notes'),
            $request->validated('vehicle_id'),
        );

        return (new LessonResource($lesson->load(self::RELATIONS)))->response()->setStatusCode(201);
    }

    public function show(Organization $organization, Lesson $lesson): JsonResponse
    {
        $this->authorize('view', [$lesson, $organization]);

        return (new LessonResource($lesson->load(self::RELATIONS)))->response();
    }

    public function reschedule(
        RescheduleLessonRequest $request,
        Organization $organization,
        Lesson $lesson,
        RescheduleLesson $reschedule,
    ): JsonResponse {
        $this->authorize('reschedule', [$lesson, $organization]);

        $updated = $reschedule(
            $lesson,
            CarbonImmutable::parse($request->string('starts_at')->toString()),
            CarbonImmutable::parse($request->string('ends_at')->toString()),
        );

        return (new LessonResource($updated->load(self::RELATIONS)))->response();
    }

    public function updateStatus(
        UpdateLessonStatusRequest $request,
        Organization $organization,
        Lesson $lesson,
        ChangeLessonStatus $changeStatus,
    ): JsonResponse {
        $next = LessonStatus::from($request->validated('status'));

        $this->authorize('updateStatus', [$lesson, $organization, $next]);

        $updated = $changeStatus(
            $lesson,
            $next,
            $request->validated('notes'),
            reason: $request->validated('reason'),
            actualMinutes: $request->validated('actual_minutes'),
            evolution: $request->validated('evolution'),
        );

        return (new LessonResource($updated->load(self::RELATIONS)))->response();
    }

    /**
     * Observações, evolução pedagógica e duração real.
     */
    public function update(
        UpdateLessonRequest $request,
        Organization $organization,
        Lesson $lesson,
        UpdateLessonDetails $update,
    ): JsonResponse {
        $this->authorize('update', [$lesson, $organization]);

        $updated = $update($lesson, $request->validated());

        return (new LessonResource($updated->load(self::RELATIONS)))->response();
    }

    /**
     * Situação do registro oficial da aula (manual, com evidência).
     */
    public function registry(
        LessonRegistryRequest $request,
        Organization $organization,
        Lesson $lesson,
        SetLessonRegistry $setRegistry,
    ): JsonResponse {
        $this->authorize('registry', [$lesson, $organization]);

        $updated = $setRegistry(
            $lesson,
            RegistryStatus::from($request->validated('registry_status')),
            $request->validated('registry_reference'),
            $request->validated('registry_document_id'),
        );

        return (new LessonResource($updated->load(self::RELATIONS)))->response();
    }
}
