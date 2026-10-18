<?php

namespace App\Models;

use App\Enums\MembershipRole;
use App\Services\AlertSettings;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Pendência do espaço que exige ação. Linha única por `dedup_key`; o motor de alertas cria, atualiza e resolve.
 */
#[Fillable([
    'organization_id', 'kind', 'category', 'dedup_key', 'priority', 'title', 'message', 'subject_type', 'subject_id',
    'audience', 'instructor_id', 'due_on', 'status', 'resolved_at', 'resolved_reason', 'first_seen_at', 'last_seen_at',
])]
class Alert extends Model
{
    public const PRIORITIES = ['low' => 0, 'normal' => 1, 'high' => 2, 'critical' => 3];

    protected $attributes = ['status' => 'open', 'priority' => 'normal', 'audience' => 'staff'];

    protected function casts(): array
    {
        return ['due_on' => 'date', 'resolved_at' => 'datetime', 'first_seen_at' => 'datetime', 'last_seen_at' => 'datetime'];
    }

    public function states(): HasMany
    {
        return $this->hasMany(AlertUserState::class);
    }

    /**
     * Alertas que o usuário pode ver agora: a equipe vê os de equipe (gestores sempre; "equipe" conforme a
     * configuração do espaço) e o instrutor vê os atribuídos a ele. Revogar o acesso encerra a visibilidade
     * porque o papel é avaliado a cada consulta.
     *
     * @param Builder<self> $query
     */
    public function scopeVisibleTo(Builder $query, Organization $organization, User $user): void
    {
        $role = $organization->roleFor($user);
        $instructorId = $user->instructor?->getKey();
        $settings = app(AlertSettings::class)->for($organization);

        $query->where('organization_id', $organization->getKey())->where(function (Builder $q) use ($role, $instructorId, $settings) {
            $q->whereRaw('1 = 0');

            $staffSees = $role !== null && $role->canOperate() && ($role !== MembershipRole::Staff || $settings['staff_receives']);

            if ($staffSees) {
                $q->orWhereIn('audience', ['staff', 'both', 'finance']);
            }

            if ($role !== null && $instructorId !== null) {
                $q->orWhere(fn (Builder $own) => $own->whereIn('audience', ['instructor', 'both'])->where('instructor_id', $instructorId));
            }
        });
    }
}
