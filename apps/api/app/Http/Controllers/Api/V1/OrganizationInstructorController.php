<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Instructors\LinkInstructorToOrganization;
use App\Exceptions\BusinessRuleException;
use App\Http\Controllers\Controller;
use App\Http\Requests\Instructors\InstructorRequest;
use App\Http\Requests\Instructors\UpdateInstructorLinkRequest;
use App\Http\Resources\InstructorResource;
use App\Models\Instructor;
use App\Models\Organization;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;

/**
 * Instrutores de uma organização.
 *
 * Dois conceitos separados:
 * - Identidade (nome, credencial, categorias): global. Só editável se não houver conta vinculada.
 * - Vínculo com o espaço (active): local. A equipe pode ativar/desativar.
 */
class OrganizationInstructorController extends Controller
{
    public function index(Request $request, Organization $organization): AnonymousResourceCollection
    {
        $this->authorize('viewAny', [Instructor::class, $organization]);

        $query = $organization->instructors();

        if ($request->has('active')) {
            $query->wherePivot('active', $request->boolean('active'));
        }

        $instructors = $query
            ->orderBy('instructors.full_name')
            ->paginate($this->perPage($request));

        return InstructorResource::collection($instructors);
    }

    /**
     * Cadastra um instrutor sem conta de acesso e já o vincula ao espaço.
     */
    public function store(
        InstructorRequest $request,
        Organization $organization,
        LinkInstructorToOrganization $link,
    ): JsonResponse {
        $this->authorize('create', [Instructor::class, $organization]);

        $instructor = DB::transaction(function () use ($request, $organization, $link) {
            $instructor = Instructor::create(array_merge(
                ['categories' => []],
                $request->validated(),
                ['user_id' => null],
            ));
            $link($organization, $instructor);

            return $instructor;
        });

        $instructor = $organization->instructors()->whereKey($instructor->getKey())->firstOrFail();

        return (new InstructorResource($instructor))->response()->setStatusCode(201);
    }

    public function show(Organization $organization, Instructor $instructor): JsonResponse
    {
        $this->authorize('view', [$instructor, $organization]);

        return (new InstructorResource($instructor))->response();
    }

    /**
     * Identidade do instrutor. Bloqueada quando há conta vinculada: o próprio instrutor
     * altera seus dados em /me/instructor.
     */
    public function update(InstructorRequest $request, Organization $organization, Instructor $instructor): JsonResponse
    {
        if ($instructor->user_id !== null) {
            throw new BusinessRuleException(
                'Este instrutor já tem conta de acesso. Ele mesmo deve atualizar seus dados.',
                'instructor_identity_locked',
                403,
            );
        }

        $this->authorize('updateIdentity', [$instructor, $organization]);

        $instructor->update($request->validated());

        return (new InstructorResource($organization->instructors()->whereKey($instructor->getKey())->firstOrFail()))
            ->response();
    }

    public function link(
        UpdateInstructorLinkRequest $request,
        Organization $organization,
        Instructor $instructor,
        LinkInstructorToOrganization $link,
    ): JsonResponse {
        $this->authorize('toggleLink', [$instructor, $organization]);

        $link($organization, $instructor, $request->boolean('active'));

        // Desativar o vínculo não mexe na agenda: devolve os compromissos futuros para a equipe resolver.
        $affected = $request->boolean('active')
            ? []
            : app(\App\Services\CommitmentFinder::class)->find($organization, null, $instructor->getKey(), now());

        return (new InstructorResource($organization->instructors()->whereKey($instructor->getKey())->firstOrFail()))
            ->additional(['meta' => ['affected' => $affected]])
            ->response();
    }
}
