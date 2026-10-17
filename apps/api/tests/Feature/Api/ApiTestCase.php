<?php

namespace Tests\Feature\Api;

use App\Enums\ChecklistItemStatus;
use App\Enums\ChecklistSource;
use App\Enums\LessonStatus;
use App\Enums\LicenseCategory;
use App\Enums\MembershipRole;
use App\Models\Enrollment;
use App\Models\Instructor;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\QualificationProcess;
use App\Models\Student;
use App\Models\User;
use App\Models\Vehicle;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * Base dos testes de API: banco limpo a cada teste e helpers de cenário.
 */
abstract class ApiTestCase extends TestCase
{
    use RefreshDatabase;

    protected string $prefix = '/api/v1';

    protected function actingAsUser(User $user): static
    {
        Sanctum::actingAs($user);

        return $this;
    }

    protected function organizationWithOwner(string $type = 'cfc', ?User $owner = null): Organization
    {
        $organization = $type === 'independent'
            ? Organization::factory()->independent()->create()
            : Organization::factory()->create();

        $owner ??= User::factory()->create();
        $organization->members()->attach($owner->getKey(), ['role' => MembershipRole::Owner->value]);

        return $organization;
    }

    protected function addMember(Organization $organization, User $user, MembershipRole $role): void
    {
        $organization->members()->attach($user->getKey(), ['role' => $role->value]);
    }

    /**
     * Cria o perfil do instrutor e o vincula ao espaço (vínculo profissional).
     */
    protected function linkInstructor(Organization $organization, ?User $user = null, bool $active = true): Instructor
    {
        $instructor = Instructor::factory()->create(['user_id' => $user?->getKey()]);
        $organization->instructors()->attach($instructor->getKey(), ['active' => $active]);

        return $instructor;
    }

    /**
     * Matrícula com aluno e categoria B, toda na mesma organização.
     */
    protected function enrollmentFor(Organization $organization): Enrollment
    {
        $student = Student::factory()->for($organization)->create();

        return Enrollment::create([
            'organization_id' => $organization->getKey(),
            'student_id' => $student->getKey(),
            'partner_id' => null,
            'category' => LicenseCategory::B,
        ]);
    }

    /**
     * Janela de horário futura, em ISO 8601 UTC.
     *
     * @return array{0: string, 1: string}
     */
    protected function window(int $daysAhead = 3, int $hour = 9, int $minutes = 60): array
    {
        $start = now()->utc()->addDays($daysAhead)->startOfDay()->addHours($hour);

        return [$start->toIso8601String(), $start->copy()->addMinutes($minutes)->toIso8601String()];
    }

    /**
     * Aula gravada diretamente (sem regras de conflito), para montar cenários de teste.
     */
    protected function lessonFor(
        Organization $organization,
        Instructor $instructor,
        Enrollment $enrollment,
        string $start,
        string $end,
        LessonStatus $status = LessonStatus::Scheduled,
    ): Lesson {
        return Lesson::create([
            'organization_id' => $organization->getKey(),
            'enrollment_id' => $enrollment->getKey(),
            'instructor_id' => $instructor->getKey(),
            'starts_at' => CarbonImmutable::parse($start)->utc(),
            'ends_at' => CarbonImmutable::parse($end)->utc(),
            'status' => $status,
            'notes' => null,
        ]);
    }

    protected function vehicleFor(Organization $organization, LicenseCategory $category = LicenseCategory::B, array $overrides = []): Vehicle
    {
        return Vehicle::factory()->create(['organization_id' => $organization->getKey(), 'category' => $category] + $overrides);
    }

    /**
     * Processo de primeira habilitação B criado pelo endpoint (com checklist), mais a matrícula ligada a ele.
     *
     * @return array{0: QualificationProcess, 1: Enrollment}
     */
    protected function processWithEnrollment(Organization $organization, User $as, string $type = 'first_license'): array
    {
        $student = Student::factory()->for($organization)->create();
        $base = $this->prefix."/organizations/{$organization->getKey()}";

        $processId = $this->actingAsUser($as)->postJson("{$base}/qualification-processes", [
            'student_id' => $student->getKey(),
            'type' => $type,
            'uf' => 'MG',
            'current_categories' => $type === 'first_license' ? [] : ['A'],
            'target_categories' => ['B'],
        ])->assertCreated()->json('data.id');

        $enrollment = Enrollment::create([
            'organization_id' => $organization->getKey(),
            'student_id' => $student->getKey(),
            'qualification_process_id' => $processId,
            'category' => LicenseCategory::B,
        ]);

        return [QualificationProcess::findOrFail($processId), $enrollment];
    }

    /**
     * Confere todos os itens obrigatórios do processo, como a equipe faria depois de ver os documentos.
     */
    protected function releasePractice(QualificationProcess $process, User $checker): void
    {
        $process->checklistItems()->where('required', true)->update([
            'status' => ChecklistItemStatus::Verified,
            'source' => ChecklistSource::Document,
            'checked_by' => $checker->getKey(),
            'checked_at' => now(),
        ]);
    }
}
