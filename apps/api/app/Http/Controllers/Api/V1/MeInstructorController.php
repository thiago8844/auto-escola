<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Instructors\CreateInstructorProfile;
use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Instructors\InstructorRequest;
use App\Http\Resources\InstructorResource;
use App\Models\Instructor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Perfil profissional da própria conta. Esta é a única forma de alterar a identidade
 * de um instrutor que já tem conta vinculada.
 */
class MeInstructorController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return (new InstructorResource($this->profileOrFail($request)))->response();
    }

    public function store(InstructorRequest $request, CreateInstructorProfile $createProfile): JsonResponse
    {
        $instructor = $createProfile($request->user(), $request->validated());

        return (new InstructorResource($instructor))->response()->setStatusCode(201);
    }

    public function update(InstructorRequest $request): JsonResponse
    {
        $instructor = $this->profileOrFail($request);
        $instructor->update($request->validated());

        return (new InstructorResource($instructor->refresh()))->response();
    }

    private function profileOrFail(Request $request): Instructor
    {
        // Consulta direta (e não a relação cacheada) para refletir o estado atual do banco.
        $instructor = $request->user()->instructor()->first();

        if ($instructor === null) {
            throw new BusinessRuleException('Você ainda não tem perfil de instrutor.', 'instructor_profile_missing', 404);
        }

        return $instructor;
    }
}
