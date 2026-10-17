<?php

namespace Database\Seeders;

use App\Actions\Instructors\CreateInstructorProfile;
use App\Actions\Lessons\ScheduleLesson;
use App\Actions\Organizations\CreateOrganization;
use App\Actions\Processes\CreateQualificationProcess;
use App\Enums\ChecklistItemStatus;
use App\Enums\ChecklistSource;
use App\Enums\LicenseCategory;
use App\Enums\MembershipRole;
use App\Models\Enrollment;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\Student;
use App\Models\User;
use App\Models\Vehicle;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Dados de demonstração: CFC Alfa, CFC Beta, o espaço particular de João e uma aula em cada um,
 * com veículo e processo de habilitação. No CFC Alfa o aluno está liberado para a prática;
 * nos demais o checklist continua pendente.
 *
 * ⚠ CREDENCIAIS DE DEMONSTRAÇÃO (somente desenvolvimento/teste):
 *   Senha de todas as contas: "demo-autoescola-123"
 *   maria@cfc-alfa.demo    → owner do CFC Alfa
 *   carlos@cfc-beta.demo   → owner do CFC Beta
 *   joao@autoescola.demo   → instrutor nos três espaços (CFC Alfa, CFC Beta, particular)
 *
 * Não é chamado por DatabaseSeeder. Execute explicitamente:
 *   php artisan db:seed --class=DemoSeeder
 * Recusa rodar em produção.
 */
class DemoSeeder extends Seeder
{
    public const PASSWORD = 'demo-autoescola-123';

    public function __construct(
        private readonly CreateOrganization $createOrganization,
        private readonly CreateInstructorProfile $createProfile,
        private readonly ScheduleLesson $scheduleLesson,
    ) {}

    private readonly CreateQualificationProcess $createProcess;

    public function run(): void
    {
        $this->createProcess = app(CreateQualificationProcess::class);

        if (app()->environment('production')) {
            throw new RuntimeException('DemoSeeder não pode rodar em produção.');
        }

        $maria = $this->user('Maria Alfa', 'maria@cfc-alfa.demo');
        $carlos = $this->user('Carlos Beta', 'carlos@cfc-beta.demo');
        $joao = $this->user('João Silva', 'joao@autoescola.demo');

        $alfa = $this->organization($maria, 'CFC Alfa', 'cfc');
        $beta = $this->organization($carlos, 'CFC Beta', 'cfc');

        // João cria o espaço particular; o perfil dele é criado e vinculado automaticamente.
        $particular = Organization::query()
            ->whereHas('members', fn ($q) => $q->where('users.id', $joao->getKey()))
            ->where('type', 'independent')
            ->first()
            ?? $this->createOrganization->__invoke($joao, ['name' => 'João — Particular', 'type' => 'independent']);

        $profile = $joao->fresh()->instructor ?? ($this->createProfile)($joao, ['categories' => ['A', 'B']]);

        foreach ([$alfa, $beta] as $organization) {
            $this->addMemberOnce($organization, $joao, MembershipRole::Instructor);
            $this->linkOnce($organization, $profile);
        }

        // Uma aula por espaço, em horários diferentes para não gerar conflito de propósito.
        $this->lessonOnce($alfa, $profile, 'Aluno Alfa Demo', CarbonImmutable::now()->addDays(2)->setTime(9, 0), released: true);
        $this->lessonOnce($beta, $profile, 'Aluno Beta Demo', CarbonImmutable::now()->addDays(2)->setTime(14, 0));
        $this->lessonOnce($particular, $profile, 'Aluno Particular Demo', CarbonImmutable::now()->addDays(3)->setTime(10, 0));

        $this->command?->info('Demo criada. Senha de todas as contas: '.self::PASSWORD);
    }

    private function user(string $name, string $email): User
    {
        return User::query()->firstOrCreate(
            ['email' => $email],
            ['name' => $name, 'password' => self::PASSWORD, 'email_verified_at' => now()],
        );
    }

    private function organization(User $owner, string $name, string $type): Organization
    {
        $existing = Organization::query()->where('name', $name)->first();

        return $existing ?? $this->createOrganization->__invoke($owner, ['name' => $name, 'type' => $type]);
    }

    private function addMemberOnce(Organization $organization, User $user, MembershipRole $role): void
    {
        if (! $organization->members()->whereKey($user->getKey())->exists()) {
            $organization->members()->attach($user->getKey(), ['role' => $role->value]);
        }
    }

    private function linkOnce(Organization $organization, Instructor $instructor): void
    {
        if (! $organization->instructors()->whereKey($instructor->getKey())->exists()) {
            $organization->instructors()->attach($instructor->getKey(), ['active' => true]);
        }
    }

    private function lessonOnce(Organization $organization, Instructor $instructor, string $studentName, CarbonImmutable $start, bool $released = false): void
    {
        $alreadyScheduled = $organization->lessons()->where('instructor_id', $instructor->getKey())->exists();

        if ($alreadyScheduled) {
            return;
        }

        $student = Student::query()->firstOrCreate(
            ['organization_id' => $organization->getKey(), 'name' => $studentName],
            ['cpf' => null, 'email' => null, 'phone' => '71999990000'],
        );

        $vehicle = Vehicle::query()->firstOrCreate(
            ['organization_id' => $organization->getKey(), 'plate' => 'DEM'.$organization->getKey().'A00'],
            ['model' => 'Argo', 'brand' => 'Fiat', 'year' => 2023, 'category' => LicenseCategory::B, 'crlv_expires_at' => now()->addYear()->toDateString()],
        );

        $process = ($this->createProcess)($organization, [
            'student_id' => $student->getKey(),
            'type' => 'first_license',
            'uf' => 'MG',
            'municipality' => 'Belo Horizonte',
            'current_categories' => [],
            'target_categories' => ['B'],
        ]);

        if ($released) {
            $process->checklistItems()->where('required', true)->update([
                'status' => ChecklistItemStatus::Verified,
                'source' => ChecklistSource::Document,
                'checked_at' => now(),
            ]);
        }

        $enrollment = Enrollment::query()->firstOrCreate(
            ['organization_id' => $organization->getKey(), 'student_id' => $student->getKey()],
            ['category' => LicenseCategory::B, 'qualification_process_id' => $process->getKey()],
        );

        ($this->scheduleLesson)(
            $organization,
            $enrollment,
            $instructor->getKey(),
            $start,
            $start->addHour(),
            'Aula de demonstração',
            $vehicle->getKey(),
        );
    }
}
