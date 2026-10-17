<?php

namespace App\Actions\Organizations;

use App\Actions\Instructors\CreateInstructorProfile;
use App\Actions\Instructors\LinkInstructorToOrganization;
use App\Enums\MembershipRole;
use App\Enums\OrganizationType;
use App\Exceptions\BusinessRuleException;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Cria um espaço de trabalho e torna o criador proprietário, na mesma transação.
 *
 * Espaço particular (independent): o criador também tem seu perfil de instrutor
 * vinculado a ele. Cada usuário pode ter apenas um espaço particular como proprietário.
 */
class CreateOrganization
{
    public function __construct(
        private readonly CreateInstructorProfile $createProfile,
        private readonly LinkInstructorToOrganization $link,
    ) {}

    /**
     * @param  array{name: string, type: string, document?: ?string, email?: ?string, phone?: ?string, timezone?: string}  $data
     */
    public function __invoke(User $user, array $data): Organization
    {
        $type = OrganizationType::from($data['type']);

        return DB::transaction(function () use ($user, $data, $type) {
            // Serializa criações concorrentes do mesmo usuário para não gerar dois espaços particulares.
            User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();

            if ($type === OrganizationType::Independent && $this->ownsIndependentSpace($user)) {
                throw new BusinessRuleException(
                    'Você já possui um espaço particular.',
                    'independent_space_exists',
                    422,
                );
            }

            $organization = Organization::create([
                'name' => $data['name'],
                'type' => $type,
                'document' => $data['document'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'timezone' => $data['timezone'] ?? config('autoescola.default_timezone'),
            ]);

            $organization->members()->attach($user->getKey(), ['role' => MembershipRole::Owner->value]);

            if ($type === OrganizationType::Independent) {
                $profile = Instructor::query()->where('user_id', $user->getKey())->first()
                    ?? ($this->createProfile)($user, ['categories' => []]);

                ($this->link)($organization, $profile);
            }

            return $organization;
        });
    }

    private function ownsIndependentSpace(User $user): bool
    {
        return Organization::query()
            ->where('type', OrganizationType::Independent->value)
            ->whereHas('members', fn ($q) => $q
                ->where('users.id', $user->getKey())
                ->where('organization_user.role', MembershipRole::Owner->value))
            ->exists();
    }
}
