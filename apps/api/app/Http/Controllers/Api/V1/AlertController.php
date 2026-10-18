<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AlertResource;
use App\Models\Alert;
use App\Models\AlertUserState;
use App\Models\Organization;
use App\Services\AlertEngine;
use App\Services\AlertSettings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

/**
 * Central de pendências (o sino). Cada usuário vê só o que o seu papel permite no momento da consulta e
 * guarda o próprio estado de leitura e arquivamento; o estado persiste entre sessões e navegadores.
 */
class AlertController extends Controller
{
    public function index(Request $request, Organization $organization): AnonymousResourceCollection
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['open', 'resolved', 'all'])],
            'unread' => ['nullable', 'boolean'],
            'archived' => ['nullable', 'boolean'],
            'category' => ['nullable', 'string', 'max:20'],
            'priority' => ['nullable', Rule::in(array_keys(Alert::PRIORITIES))],
        ]);

        $user = $request->user();
        $query = $this->visible($organization, $request)->with(['states' => fn ($q) => $q->where('user_id', $user->getKey())]);

        $status = $data['status'] ?? 'open';
        if ($status !== 'all') {
            $query->where('status', $status);
        }

        // Arquivados ficam fora da lista padrão; `archived=1` mostra só eles.
        $archivedFilter = fn (Builder $q) => $q->where('user_id', $user->getKey())->whereNotNull('archived_at');
        $request->boolean('archived') ? $query->whereHas('states', $archivedFilter) : $query->whereDoesntHave('states', $archivedFilter);

        $query->when($request->boolean('unread'), fn (Builder $q) => $q->whereDoesntHave('states', fn ($s) => $s->where('user_id', $user->getKey())->whereNotNull('read_at')))
            ->when($request->filled('category'), fn (Builder $q) => $q->where('category', $request->string('category')))
            ->when($request->filled('priority'), fn (Builder $q) => $q->where('priority', $request->string('priority')));

        $page = $query
            ->orderByRaw("FIELD(priority, 'critical', 'high', 'normal', 'low')")
            ->orderByDesc('first_seen_at')->orderByDesc('id')
            ->paginate($this->perPage($request));

        return AlertResource::collection($page)->additional(['meta' => $this->counters($organization, $request)]);
    }

    public function summary(Request $request, Organization $organization): JsonResponse
    {
        return response()->json(['data' => $this->counters($organization, $request)]);
    }

    public function read(Request $request, Organization $organization, Alert $alert): JsonResponse
    {
        $this->assertVisible($organization, $request, $alert);
        $this->touch($alert, $request, ['read_at' => now()]);

        return response()->json(['data' => $this->counters($organization, $request)]);
    }

    public function readAll(Request $request, Organization $organization): JsonResponse
    {
        $user = $request->user();

        $this->visible($organization, $request)
            ->where('status', 'open')
            ->whereDoesntHave('states', fn ($s) => $s->where('user_id', $user->getKey())->whereNotNull('read_at'))
            ->pluck('id')
            ->each(fn (int $id) => AlertUserState::query()->updateOrCreate(['alert_id' => $id, 'user_id' => $user->getKey()], ['read_at' => now()]));

        return response()->json(['data' => $this->counters($organization, $request)]);
    }

    public function archive(Request $request, Organization $organization, Alert $alert): JsonResponse
    {
        $this->assertVisible($organization, $request, $alert);
        $this->touch($alert, $request, ['archived_at' => now(), 'read_at' => now()]);

        return response()->json(['data' => $this->counters($organization, $request)]);
    }

    public function unarchive(Request $request, Organization $organization, Alert $alert): JsonResponse
    {
        $this->assertVisible($organization, $request, $alert);
        $this->touch($alert, $request, ['archived_at' => null]);

        return response()->json(['data' => $this->counters($organization, $request)]);
    }

    /**
     * Reprocessa as pendências do espaço na hora (o agendador já faz isso a cada 10 minutos).
     */
    public function refresh(Request $request, Organization $organization, AlertEngine $engine): JsonResponse
    {
        $result = $engine->run($organization);

        return response()->json(['data' => $result + $this->counters($organization, $request)]);
    }

    public function settings(Request $request, Organization $organization, AlertSettings $settings): JsonResponse
    {
        return response()->json(['data' => $settings->for($organization)]);
    }

    public function updateSettings(Request $request, Organization $organization, AlertSettings $settings): JsonResponse
    {
        abort_unless($organization->roleFor($request->user())?->canManageMembers(), 403);

        $data = $request->validate([
            'crlv_lead_days' => ['sometimes', 'integer', 'between:1,180'],
            'document_lead_days' => ['sometimes', 'integer', 'between:1,180'],
            'exam_lead_days' => ['sometimes', 'integer', 'between:1,30'],
            'fee_lead_days' => ['sometimes', 'integer', 'between:1,60'],
            'release_lead_days' => ['sometimes', 'integer', 'between:1,30'],
            'low_balance_minutes' => ['sometimes', 'integer', 'between:0,1000'],
            'inactive_days' => ['sometimes', 'integer', 'between:3,180'],
            'lesson_grace_hours' => ['sometimes', 'integer', 'between:0,72'],
            'staff_receives' => ['sometimes', 'boolean'],
        ]);

        $organization->update(['alert_settings' => array_replace($organization->alert_settings ?? [], $data)]);

        return response()->json(['data' => $settings->for($organization->refresh())]);
    }

    /** @return Builder<Alert> */
    private function visible(Organization $organization, Request $request): Builder
    {
        return Alert::query()->visibleTo($organization, $request->user());
    }

    private function assertVisible(Organization $organization, Request $request, Alert $alert): void
    {
        abort_unless($this->visible($organization, $request)->whereKey($alert->getKey())->exists(), 404);
    }

    /** @param array<string, mixed> $values */
    private function touch(Alert $alert, Request $request, array $values): void
    {
        $state = AlertUserState::query()->firstOrNew(['alert_id' => $alert->getKey(), 'user_id' => $request->user()->getKey()]);

        // A primeira leitura vale; ler de novo não muda a data.
        if (array_key_exists('read_at', $values) && $state->read_at !== null) {
            unset($values['read_at']);
        }

        $state->fill($values)->save();
    }

    /** @return array{unread: int, critical_unread: int, open: int} */
    private function counters(Organization $organization, Request $request): array
    {
        $user = $request->user();
        $base = fn () => $this->visible($organization, $request)->where('status', 'open')
            ->whereDoesntHave('states', fn ($s) => $s->where('user_id', $user->getKey())->whereNotNull('archived_at'));
        $unread = fn (Builder $q) => $q->whereDoesntHave('states', fn ($s) => $s->where('user_id', $user->getKey())->whereNotNull('read_at'));

        return [
            'unread' => $unread($base())->count(),
            'critical_unread' => $unread($base())->where('priority', 'critical')->count(),
            'open' => $base()->count(),
        ];
    }
}
