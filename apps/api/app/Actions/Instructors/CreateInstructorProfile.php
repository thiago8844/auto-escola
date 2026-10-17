<?php

namespace App\Actions\Instructors;

use App\Enums\OrganizationType;
use App\Exceptions\BusinessRuleException;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Cria o perfil profissional da própria conta. Se o usuário já possui espaço
 * particular, o perfil é vinculado a ele automaticamente.
 */
class CreateInstructorProfile
{
    public function __construct(private readonly LinkInstructorToOrganization $link) {}

    /**
     * @param  array{full_name?: string, credential_number?: ?string, categories?: array<int, string>}  $data
     */
    public function __invoke(User $user, array $data): Instructor
    {
        return DB::transaction(function () use ($user, $data) {
            User::query()->whereKey($user->getKey())->lockForUpdate()->firstOrFail();

            if (Instructor::query()->where('user_id', $user->getKey())->exists()) {
                throw new BusinessRuleException(
                    'Você já possui um perfil de instrutor.',
                    'instructor_profile_exists',
                    409,
                );
            }

            $instructor = Instructor::create([
                'user_id' => $user->getKey(),
                'full_name' => $data['full_name'] ?? $user->name,
                'credential_number' => $data['credential_number'] ?? null,
                'categories' => $data['categories'] ?? [],
            ]);

            $personal = Organization::query()
                ->where('type', OrganizationType::Independent->value)
                ->whereHas('members', fn ($q) => $q
                    ->where('users.id', $user->getKey())
                    ->where('organization_user.role', 'owner'))
                ->first();

            if ($personal) {
                ($this->link)($personal, $instructor);
            }

            return $instructor;
        });
    }
}
