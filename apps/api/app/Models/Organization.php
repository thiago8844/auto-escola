<?php

namespace App\Models;

use App\Enums\MembershipRole;
use App\Enums\OrganizationType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Espaço de trabalho: uma autoescola (cfc) ou uma operação particular (independent).
 */
#[Fillable(['name', 'type', 'document', 'email', 'phone', 'address', 'city', 'state', 'timezone'])]
class Organization extends Model
{
    use HasFactory;

    /** @var array<int, MembershipRole|null> Cache de papel por usuário durante a requisição. */
    private array $roleCache = [];

    protected function casts(): array
    {
        return [
            'type' => OrganizationType::class,
        ];
    }

    /**
     * Usuários com acesso ao espaço. Usado também no route binding de {member}.
     */
    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'organization_user')
            ->withPivot('role')
            ->withTimestamps();
    }

    /**
     * Instrutores vinculados profissionalmente ao espaço. Usado no binding de {instructor}.
     */
    public function instructors(): BelongsToMany
    {
        return $this->belongsToMany(Instructor::class, 'organization_instructor')
            ->withPivot('active')
            ->withTimestamps();
    }

    public function partners(): HasMany
    {
        return $this->hasMany(Partner::class);
    }

    public function students(): HasMany
    {
        return $this->hasMany(Student::class);
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function lessons(): HasMany
    {
        return $this->hasMany(Lesson::class);
    }

    public function vehicles(): HasMany
    {
        return $this->hasMany(Vehicle::class);
    }

    public function qualificationProcesses(): HasMany
    {
        return $this->hasMany(QualificationProcess::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class);
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(Invitation::class);
    }

    /**
     * Papel do usuário neste espaço, ou null se não tiver acesso ativo.
     */
    public function roleFor(User $user): ?MembershipRole
    {
        if (! array_key_exists($user->getKey(), $this->roleCache)) {
            $membership = $this->members()->whereKey($user->getKey())->first();

            $this->roleCache[$user->getKey()] = $membership
                ? MembershipRole::from($membership->pivot->role)
                : null;
        }

        return $this->roleCache[$user->getKey()];
    }

    /**
     * Limpa o cache de papéis após alterar membros nesta mesma instância.
     */
    public function forgetRoleCache(): void
    {
        $this->roleCache = [];
    }
}
