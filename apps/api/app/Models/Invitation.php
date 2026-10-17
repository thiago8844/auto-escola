<?php

namespace App\Models;

use App\Enums\MembershipRole;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Convite para acesso a uma organização. Somente o hash do token é persistido.
 */
#[Fillable(['organization_id', 'email', 'role', 'instructor_id', 'token_hash', 'invited_by_user_id', 'expires_at'])]
#[Hidden(['token_hash'])]
class Invitation extends Model
{
    use HasFactory;

    protected function casts(): array
    {
        return [
            'role' => MembershipRole::class,
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function instructor(): BelongsTo
    {
        return $this->belongsTo(Instructor::class);
    }

    public function isPending(): bool
    {
        return $this->accepted_at === null && $this->revoked_at === null && ! $this->isExpired();
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }

    /**
     * Estado derivado para exibição. Ordem: aceito, revogado, expirado, pendente.
     */
    public function status(): string
    {
        return match (true) {
            $this->accepted_at !== null => 'accepted',
            $this->revoked_at !== null => 'revoked',
            $this->isExpired() => 'expired',
            default => 'pending',
        };
    }
}
