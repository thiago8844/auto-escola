<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Lessons\AvailableSlotsRequest;
use App\Models\Organization;
use App\Services\AvailableLessonSlots;
use Illuminate\Http\JsonResponse;

class AvailableLessonSlotsController extends Controller
{
    public function __invoke(AvailableSlotsRequest $request, Organization $organization, AvailableLessonSlots $slots): JsonResponse
    {
        return response()->json(['data' => $slots->find($organization, $request->validated()), 'meta' => [
            'date' => $request->validated('date'),
            'timezone' => $organization->timezone,
            'step_minutes' => 15,
            'message' => 'Sugestões deste dia, sem reserva. A disponibilidade será conferida novamente ao agendar.',
        ]]);
    }
}
