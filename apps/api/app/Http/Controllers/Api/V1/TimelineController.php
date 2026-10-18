<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AuditEventResource;
use App\Models\AuditEvent;
use App\Models\Organization;
use App\Models\QualificationProcess;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

/**
 * Linha do tempo paginada do aluno/processo e trilha de auditoria do espaço.
 *
 * Aluno e processo: equipe de operação (eventos de acesso ao espaço nunca aparecem aqui).
 * Trilha geral: apenas proprietário e administrador. Instrutores não têm acesso; revogar o acesso
 * de um membro encerra a consulta imediatamente, pois o papel é conferido a cada requisição.
 */
class TimelineController extends Controller
{
    public function student(Request $request, Organization $organization, Student $student): AnonymousResourceCollection
    {
        $this->authorize('viewTimeline', [$student, $organization]);

        return $this->paginate($request, AuditEvent::query()
            ->where('organization_id', $organization->getKey())
            ->where('student_id', $student->getKey()));
    }

    public function process(Request $request, Organization $organization, QualificationProcess $qualificationProcess): AnonymousResourceCollection
    {
        $this->authorize('outcome', [$qualificationProcess, $organization]);

        return $this->paginate($request, AuditEvent::query()
            ->where('organization_id', $organization->getKey())
            ->where('qualification_process_id', $qualificationProcess->getKey()));
    }

    public function organization(Request $request, Organization $organization): AnonymousResourceCollection
    {
        abort_unless($organization->roleFor($request->user())?->canAudit(), 403, 'Sem permissão para consultar a auditoria.');

        $request->validate([
            'student_id' => ['nullable', 'integer'],
            'actor_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        return $this->paginate($request, AuditEvent::query()
            ->where('organization_id', $organization->getKey())
            ->when($request->filled('student_id'), fn ($q) => $q->where('student_id', $request->integer('student_id')))
            ->when($request->filled('actor_id'), fn ($q) => $q->where('actor_id', $request->integer('actor_id')))
            ->when($request->filled('from'), fn ($q) => $q->where('created_at', '>=', \Carbon\CarbonImmutable::parse($request->string('from'), $organization->timezone ?: config('autoescola.default_timezone'))->startOfDay()->utc()))
            ->when($request->filled('to'), fn ($q) => $q->where('created_at', '<=', \Carbon\CarbonImmutable::parse($request->string('to'), $organization->timezone ?: config('autoescola.default_timezone'))->endOfDay()->utc())));
    }

    private function paginate(Request $request, $query): AnonymousResourceCollection
    {
        $request->validate(['category' => ['nullable', 'string', 'max:20']]);

        return AuditEventResource::collection(
            $query
                ->when($request->filled('category'), fn ($q) => $q->where('category', $request->string('category')))
                ->with('actor:id,name')
                ->orderByDesc('id')
                ->paginate($this->perPage($request)),
        );
    }
}
