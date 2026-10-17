<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Lessons\ListLessonsRequest;
use App\Http\Resources\LessonResource;
use App\Models\Lesson;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Agenda pessoal do instrutor, consolidada entre os espaços em que ele tem acesso.
 *
 * Cada aula aparece uma única vez (ela pertence a uma organização). A consulta parte
 * da lista de espaços com membership ativa, sem remover o isolamento entre organizações.
 */
class MyLessonController extends Controller
{
    public function index(ListLessonsRequest $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $instructor = $user->instructor;

        $query = Lesson::query()
            ->with(['organization:id,name,type', 'instructor:id,full_name', 'vehicle', 'enrollment.student'])
            ->whereIn('organization_id', $user->organizations()->select('organizations.id'));

        if ($instructor === null) {
            $query->whereRaw('0 = 1');
        } else {
            $query->where('instructor_id', $instructor->getKey());
        }

        $lessons = $query
            ->filter($request->validated(), $request->validated('timezone'))
            ->orderBy('starts_at')
            ->paginate($this->perPage($request));

        return LessonResource::collection($lessons);
    }
}
