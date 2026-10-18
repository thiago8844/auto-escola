<?php

namespace Database\Seeders;

use App\Actions\Lessons\ChangeLessonStatus;
use App\Actions\Lessons\RescheduleLesson;
use App\Actions\Lessons\ScheduleLesson;
use App\Actions\Organizations\CreateOrganization;
use App\Actions\Processes\CreateQualificationProcess;
use App\Enums\ChecklistItemStatus;
use App\Enums\ChecklistSource;
use App\Enums\LessonStatus;
use App\Models\AvailabilityBlock;
use App\Models\Document;
use App\Models\Enrollment;
use App\Models\ExternalFee;
use App\Models\FinanceAccount;
use App\Models\FinanceCategory;
use App\Models\FinancePaymentMethod;
use App\Models\Instructor;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\Partner;
use App\Models\PracticalExam;
use App\Models\Student;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\AlertEngine;
use App\Services\CreditLedger;
use App\Services\Finance\FinanceDefaults;
use App\Services\Finance\FinanceService;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

final class InstrutorDemoSeeder extends Seeder
{
    public const EMAIL = 'instruteste@example.com';

    public const PASSWORD = '123';

    private const KEY = 'instrutor';

    /** Dias de histórico (aulas já realizadas, faltas e cancelamentos) antes de hoje. */
    private const HISTORY_DAYS = 45;

    /** Dias de agenda futura a partir de hoje. */
    private const FUTURE_DAYS = 30;

    /** Início de cada aula de uma hora; 17h fica livre para remarcações e aulas avulsas. */
    private const LESSON_HOURS = [8, 9, 10, 11, 13, 14, 15, 16];

    public function __construct(
        private readonly DemoDataset $dataset,
        private readonly CreateOrganization $createOrganization,
        private readonly CreateQualificationProcess $createProcess,
        private readonly CreditLedger $credits,
        private readonly ScheduleLesson $scheduleLesson,
        private readonly ChangeLessonStatus $changeLessonStatus,
        private readonly RescheduleLesson $rescheduleLesson,
        private readonly FinanceDefaults $financeDefaults,
        private readonly FinanceService $finance,
        private readonly AlertEngine $alertEngine,
    ) {}

    /** Em produção a senha vem de DEMO_SEED_PASSWORD: nunca use a senha de desenvolvimento num ambiente público. */
    private function password(): string
    {
        if (! app()->environment('production')) {
            return self::PASSWORD;
        }

        $password = (string) config('autoescola.demo_seed_password');

        if (strlen($password) < 8) {
            throw new RuntimeException('Defina DEMO_SEED_PASSWORD (mínimo 8 caracteres) para gerar a demonstração em produção.');
        }

        return $password;
    }

    public function run(): void
    {
        $timezone = config('autoescola.default_timezone');
        $now = CarbonImmutable::now($timezone);
        $today = $now->startOfDay();
        $path = 'demo/'.self::KEY.'/'.Str::uuid();
        $password = $this->password();

        try {
            $this->dataset->rebuildDemoDataset(self::KEY, self::EMAIL, function () use ($today, $now, $timezone, $path, $password): array {
                $user = User::create([
                    'name' => 'Rafael Andrade',
                    'email' => self::EMAIL,
                    'password' => $password,
                ]);
                $user->forceFill(['email_verified_at' => $now])->save();
                $organization = ($this->createOrganization)($user, [
                    'name' => 'Rafael Andrade — Instrutor autônomo',
                    'type' => 'independent',
                    'timezone' => $timezone,
                    'email' => self::EMAIL,
                    'phone' => '31988880000',
                    'address' => 'Rua das Acácias, 120',
                    'city' => 'Belo Horizonte',
                    'state' => 'MG',
                ]);
                $hours = array_fill_keys(range(1, 6), [['start' => '08:00', 'end' => '18:00']]);
                $hours[7] = [['start' => '09:00', 'end' => '18:00']];
                $organization->update(['business_hours' => $hours]);
                $instructor = $user->instructor;
                $instructor->update(['categories' => ['B'], 'credential_number' => 'DEMO-RA-001']);
                $organization->instructors()->updateExistingPivot($instructor->getKey(), ['weekly_hours' => json_encode($hours)]);

                $vehicles = [
                    Vehicle::create(['organization_id' => $organization->getKey(), 'plate' => 'RCD1A23', 'brand' => 'Fiat', 'model' => 'Argo', 'year' => 2023, 'category' => 'B', 'crlv_expires_at' => $today->addMonths(5)->toDateString()]),
                    Vehicle::create(['organization_id' => $organization->getKey(), 'plate' => 'RCD2B34', 'brand' => 'Hyundai', 'model' => 'HB20', 'year' => 2024, 'category' => 'B', 'crlv_expires_at' => $today->addMonths(3)->toDateString()]),
                ];
                $partners = [
                    Partner::create(['organization_id' => $organization->getKey(), 'name' => 'CFC Serra Azul', 'phone' => '3130001000']),
                    Partner::create(['organization_id' => $organization->getKey(), 'name' => 'CFC Via Nova', 'phone' => '3130002000']),
                ];

                $this->financeDefaults->ensure($organization);
                $account = FinanceAccount::create(['organization_id' => $organization->getKey(), 'name' => 'Conta de trabalho', 'kind' => 'bank', 'institution' => 'Banco fictício', 'opening_balance_cents' => 150000, 'opening_date' => $today->subDays(90)->toDateString()]);
                $income = FinanceCategory::query()->where('organization_id', $organization->getKey())->where('type', 'income')->where('name', FinanceDefaults::CATEGORY_TUITION)->firstOrFail();
                $expense = FinanceCategory::query()->where('organization_id', $organization->getKey())->where('type', 'expense')->where('name', 'Combustível')->firstOrFail();
                $pix = FinancePaymentMethod::query()->where('organization_id', $organization->getKey())->where('kind', 'pix')->firstOrFail();

                $firstNames = ['Ana', 'Bruno', 'Camila', 'Daniel', 'Elisa', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João', 'Karina', 'Lucas'];
                $lastNames = ['Almeida', 'Barbosa', 'Costa', 'Duarte'];
                $enrollments = [];

                for ($i = 0; $i < 48; $i++) {
                    $student = Student::create([
                        'organization_id' => $organization->getKey(),
                        'name' => $firstNames[$i % 12].' '.$lastNames[intdiv($i, 12)],
                        'email' => sprintf('aluno%02d@exemplo.demo', $i + 1),
                        'phone' => sprintf('3199000%04d', $i + 1),
                        'birth_date' => $today->subYears(19 + ($i % 18))->subDays($i * 11)->toDateString(),
                        'identity_number' => sprintf('MG-%02d.%03d.%03d', 10 + $i % 80, 100 + $i, 200 + $i),
                        'identity_issuer' => 'SSP/MG',
                        'partner_id' => $partners[$i % 2]->getKey(),
                    ]);
                    $process = ($this->createProcess)($organization, [
                        'student_id' => $student->getKey(), 'type' => 'first_license', 'uf' => 'MG',
                        'municipality' => 'Belo Horizonte', 'current_categories' => [], 'target_categories' => ['B'],
                        'opened_at' => $today->subDays(80 - ($i % 25))->toDateString(),
                        'status' => $i < 32 ? 'active' : 'preparing',
                    ]);
                    if ($i < 32) {
                        $process->checklistItems()->where('required', true)->update([
                            'status' => ChecklistItemStatus::Verified->value,
                            'source' => ChecklistSource::Document->value,
                            'checked_by' => $user->getKey(), 'checked_at' => $today->subDays(40),
                        ]);
                    }
                    $enrollment = Enrollment::create([
                        'organization_id' => $organization->getKey(), 'student_id' => $student->getKey(),
                        'qualification_process_id' => $process->getKey(),
                        'partner_id' => $partners[$i % 2]->getKey(),
                        'category' => 'B', 'status' => $i < 30 ? 'in_service' : ($i < 40 ? 'contracted' : 'prospect'),
                        'contracted_minutes' => $i < 40 ? ($i === 1 ? 180 : 1200) : null,
                        'price_cents' => $i < 40 ? ($i === 1 ? 27000 : 180000) : null,
                    ]);
                    $enrollment->forceFill([
                        'assigned_instructor_id' => $instructor->getKey(), 'assigned_at' => $today->subDays(65),
                    ])->save();
                    $enrollments[$i] = $enrollment;

                    if ($i < 40) {
                        $minutes = $i === 1 ? 180 : 1200;
                        $price = $i === 1 ? 27000 : 180000;
                        $this->credits->grant($enrollment, [
                            'description' => $i === 1 ? 'Pacote complementar — 3 aulas' : 'Pacote prático — 20 aulas',
                            'minutes' => $minutes, 'reference_minutes' => 60, 'price_cents' => $price,
                        ]);
                        $issued = $today->subDays(70 - ($i % 30));
                        $entry = $this->finance->createEntry($organization, [
                            'type' => 'receivable', 'description' => 'Pacote prático de '.$student->name,
                            'category_id' => $income->getKey(), 'student_id' => $student->getKey(),
                            'enrollment_id' => $enrollment->getKey(), 'total_cents' => $price,
                            'issued_on' => $issued->toDateString(),
                            'plan' => ['count' => 1, 'first_due' => ($i < 26 ? $issued->addDays(10) : $today->addDays(7 + ($i % 10)))->toDateString()],
                        ]);
                        if ($i < 26) {
                            $this->finance->recordPayments($organization, $entry->installments->first(), [[
                                'account_id' => $account->getKey(), 'method_id' => $pix->getKey(),
                                'paid_on' => $issued->addDays(5)->toDateString(), 'applied_cents' => $price,
                            ]]);
                        }
                    }

                    if ($i < 5) {
                        $this->document($organization, $user, $student, $process->getKey(), $today, $path, $i);
                    }

                    if ($i >= 5 && $i < 10) {
                        $exam = PracticalExam::create([
                            'organization_id' => $organization->getKey(), 'qualification_process_id' => $process->getKey(),
                            'student_id' => $student->getKey(), 'enrollment_id' => $enrollment->getKey(),
                            'partner_id' => $student->partner_id,
                            'category' => 'B', 'attempt_number' => 1,
                            'scheduled_at' => $today->addDays(62 + 2 * $i)->setTime(10, 0)->utc(),
                            'location' => 'Unidade de exame Centro', 'status' => 'scheduled',
                        ]);
                        $fee = ExternalFee::create([
                            'organization_id' => $organization->getKey(), 'qualification_process_id' => $process->getKey(),
                            'student_id' => $student->getKey(), 'kind' => 'Exame prático', 'amount_cents' => 12000,
                            'issued_at' => $today->toDateString(), 'due_date' => $today->addDays(12)->toDateString(),
                            'status' => 'pending', 'obligor' => 'student',
                        ]);
                        $exam->fees()->attach($fee->getKey());
                    }
                }

                $this->scheduleDailyLessons($organization, $instructor, $vehicles, $enrollments, $now);

                for ($i = 0; $i < 5; $i++) {
                    $issued = $today->subDays(55 - $i * 10);
                    $entry = $this->finance->createEntry($organization, [
                        'type' => 'payable', 'description' => 'Combustível e deslocamento '.$i,
                        'category_id' => $expense->getKey(), 'party_id' => $this->fuelParty($organization),
                        'total_cents' => 12000 + $i * 900, 'issued_on' => $issued->toDateString(),
                        'plan' => ['count' => 1, 'first_due' => ($i < 3 ? $issued->addDays(5) : $today->addDays(6 + $i))->toDateString()],
                    ]);
                    if ($i < 3) {
                        $this->finance->recordPayments($organization, $entry->installments->first(), [[
                            'account_id' => $account->getKey(), 'method_id' => $pix->getKey(),
                            'paid_on' => $issued->addDays(3)->toDateString(), 'applied_cents' => $entry->total_cents,
                        ]]);
                    }
                }

                AvailabilityBlock::create([
                    'organization_id' => $organization->getKey(), 'resource_type' => 'instructor',
                    'instructor_id' => $instructor->getKey(), 'scope' => 'personal', 'kind' => 'absence',
                    'starts_at' => $today->addDays(70)->setTime(8, 0)->utc(),
                    'ends_at' => $today->addDays(70)->setTime(12, 0)->utc(),
                    'reason' => 'Compromisso pessoal', 'created_by' => $user->getKey(),
                ]);
                $this->alertEngine->run($organization, $now);

                return [$user, $organization];
            });
        } catch (Throwable $exception) {
            Storage::disk(config('autoescola.documents_disk'))->deleteDirectory($path);

            throw $exception;
        }

        $this->command?->info('Instrutor de demonstração criado: '.self::EMAIL.' / '.self::PASSWORD);
    }

    /**
     * Agenda de um instrutor que trabalha o dia todo: 8 aulas por dia útil (seg a sáb), das 08h às 12h e das 13h às 17h.
     * Os alunos rodam em ordem, então ninguém tem duas aulas no mesmo dia. Aulas já encerradas recebem desfecho.
     *
     * @param  array<int, Vehicle>  $vehicles
     * @param  array<int, Enrollment>  $enrollments
     */
    private function scheduleDailyLessons(Organization $organization, Instructor $instructor, array $vehicles, array $enrollments, CarbonImmutable $now): void
    {
        $today = $now->startOfDay();
        $pastPool = array_values(array_filter(array_keys($enrollments), fn (int $i) => $i < 30 && $i !== 1));
        $futurePool = array_values(array_filter(array_keys($enrollments), fn (int $i) => $i < 40 && $i !== 1));
        $pastCursor = 0;
        $futureCursor = 0;
        $slotNumber = 0;

        for ($offset = -self::HISTORY_DAYS; $offset <= self::FUTURE_DAYS; $offset++) {
            $day = $today->addDays($offset);
            if ($day->isoWeekday() === 7) {
                continue;
            }

            foreach (self::LESSON_HOURS as $hour) {
                $start = $day->setTime($hour, 0);
                $isPast = $offset < 0;
                $pool = $isPast ? $pastPool : $futurePool;
                $cursor = $isPast ? $pastCursor++ : $futureCursor++;
                $enrollment = $enrollments[$pool[$cursor % count($pool)]];

                // Horários em UTC: a checagem de conflito compara com o banco, que guarda UTC
                $lesson = ($this->scheduleLesson)($organization, $enrollment, $instructor->getKey(), $start->utc(), $start->addHour()->utc(), 'Aula prática', $vehicles[$slotNumber % 2]->getKey());
                $slotNumber++;

                if ($start->addHour()->lessThanOrEqualTo($now)) {
                    $outcome = $slotNumber % 13 === 0 ? LessonStatus::Cancelled : ($slotNumber % 11 === 0 ? LessonStatus::Missed : LessonStatus::Completed);
                    ($this->changeLessonStatus)($lesson, $outcome, reason: $outcome === LessonStatus::Completed ? null : 'Ocorrência de demonstração', evolution: $outcome === LessonStatus::Completed ? 'Evolução em controle e manobras.' : null);
                }
            }
        }

        // Um aluno com pacote pequeno (2 aulas) para o teste de saldo; fica fora da rodízio, no horário livre das 17h
        $smallPackageLessons = [
            [$today->subDays(3)->setTime(17, 0), LessonStatus::Completed],
            [$today->addDays(3)->setTime(17, 0), LessonStatus::Scheduled],
        ];
        foreach ($smallPackageLessons as [$start, $status]) {
            $lesson = ($this->scheduleLesson)($organization, $enrollments[1], $instructor->getKey(), $start->utc(), $start->addHour()->utc(), 'Aula prática', $vehicles[0]->getKey());
            if ($status !== LessonStatus::Scheduled) {
                ($this->changeLessonStatus)($lesson, $status, evolution: 'Treino de baliza concluído.');
            }
        }

        $newStart = $today->addDays(5)->setTime(17, 0);
        ($this->rescheduleLesson)($this->lessonAt($instructor, $today->addDays(3)->setTime(17, 0)), $newStart->utc(), $newStart->addHour()->utc());
    }

    private function lessonAt(Instructor $instructor, CarbonImmutable $start): Lesson
    {
        return Lesson::query()->where('instructor_id', $instructor->getKey())->where('starts_at', $start->utc())->firstOrFail();
    }

    private function fuelParty(Organization $organization): int
    {
        return $organization->financeParties()->firstOrCreate(['name' => 'Posto Alameda'], ['active' => true])->getKey();
    }

    private function document(Organization $organization, User $user, Student $student, int $processId, CarbonImmutable $today, string $path, int $index): void
    {
        $file = $path.'/documento-'.($index + 1).'.txt';
        Storage::disk(config('autoescola.documents_disk'))->put($file, "DOCUMENTO FICTÍCIO — demonstração Rota Certa\nAluno: {$student->name}\n");
        Document::create([
            'organization_id' => $organization->getKey(), 'student_id' => $student->getKey(),
            'qualification_process_id' => $processId, 'type' => $index === 0 ? 'learning_license' : 'other',
            'status' => 'verified', 'storage_path' => $file, 'original_name' => 'documento-ficticio.txt',
            'mime_type' => 'text/plain', 'size' => Storage::disk(config('autoescola.documents_disk'))->size($file),
            'issued_at' => $today->subDays(30)->toDateString(),
            'expires_at' => $today->addDays($index === 0 ? 12 : 150)->toDateString(),
            'uploaded_by' => $user->getKey(), 'verified_by' => $user->getKey(), 'verified_at' => $today,
        ]);
    }
}
