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
#[Fillable(['name', 'type', 'document', 'email', 'phone', 'address', 'city', 'state', 'timezone', 'business_hours', 'alert_settings'])]
class Organization extends Model
{
    use HasFactory;

    /** @var array<int, MembershipRole|null> Cache de papel por usuário durante a requisição. */
    private array $roleCache = [];

    protected function casts(): array
    {
        return [
            'type' => OrganizationType::class,
            'business_hours' => 'array',
            'alert_settings' => 'array',
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
            ->withPivot('active', 'weekly_hours')
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

    public function exams(): HasMany
    {
        return $this->hasMany(PracticalExam::class);
    }

    public function externalFees(): HasMany
    {
        return $this->hasMany(ExternalFee::class);
    }

    public function availabilityBlocks(): HasMany
    {
        return $this->hasMany(AvailabilityBlock::class);
    }

    public function financeAccounts(): HasMany
    {
        return $this->hasMany(FinanceAccount::class);
    }

    public function financeCategories(): HasMany
    {
        return $this->hasMany(FinanceCategory::class);
    }

    public function financeMethods(): HasMany
    {
        return $this->hasMany(FinancePaymentMethod::class);
    }

    public function financeParties(): HasMany
    {
        return $this->hasMany(FinanceParty::class);
    }

    public function financeEntries(): HasMany
    {
        return $this->hasMany(FinanceEntry::class);
    }

    public function financeInstallments(): HasMany
    {
        return $this->hasMany(FinanceInstallment::class);
    }

    public function financePayments(): HasMany
    {
        return $this->hasMany(FinancePayment::class);
    }

    public function financeTransfers(): HasMany
    {
        return $this->hasMany(FinanceTransfer::class);
    }

    public function financeRecurrences(): HasMany
    {
        return $this->hasMany(FinanceRecurrence::class);
    }

    public function financeMovements(): HasMany
    {
        return $this->hasMany(FinanceMovement::class);
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(Alert::class);
    }

    public function maintenances(): HasMany
    {
        return $this->hasMany(VehicleMaintenance::class);
    }

    public function auditEvents(): HasMany
    {
        return $this->hasMany(AuditEvent::class);
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
