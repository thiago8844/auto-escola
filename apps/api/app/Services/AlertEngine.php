<?php

namespace App\Services;

use App\Enums\EnrollmentStatus;
use App\Enums\LessonStatus;
use App\Models\Alert;
use App\Models\AvailabilityBlock;
use App\Models\Document;
use App\Models\Enrollment;
use App\Models\ExternalFee;
use App\Models\Lesson;
use App\Models\Organization;
use App\Models\PracticalExam;
use App\Models\QualificationProcess;
use App\Models\Vehicle;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Gera, atualiza e resolve as pendências do espaço.
 *
 * Cada execução calcula o conjunto COMPLETO de pendências que existem agora (`desired`) e o reconcilia com o
 * que está gravado: a mesma pendência nunca vira duas linhas (`dedup_key`), o texto é atualizado quando muda
 * e o que deixou de existir é resolvido. É idempotente: rodar de novo (agendador, reprocesso ou botão) não
 * cria notificações repetidas. A execução trava o espaço para duas rodadas simultâneas não colidirem.
 *
 * Contas a pagar/receber entram no módulo 8; cobrança do próprio sistema está fora do escopo.
 */
class AlertEngine
{
    public function __construct(
        private readonly AlertSettings $settings,
        private readonly CommitmentFinder $finder,
        private readonly MaintenanceDue $maintenanceDue,
        private readonly CreditLedger $ledger,
    ) {}

    /**
     * @return array{created: int, updated: int, resolved: int, reopened: int, open: int}
     */
    public function run(Organization $organization, ?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $timezone = $organization->timezone ?: config('autoescola.default_timezone');
        $today = $now->setTimezone($timezone)->startOfDay();
        $config = $this->settings->for($organization);

        $desired = collect();

        foreach ([
            'vehicleCrlv', 'documents', 'maintenance', 'blocksWithCommitments', 'releasePending', 'upcomingExams',
            'missingExamResults', 'fees', 'issuance', 'balances', 'lessonsWithoutOutcome', 'inactiveStudents', 'extra',
        ] as $detector) {
            foreach ($this->{$detector}($organization, $now, $today, $timezone, $config) as $item) {
                $desired->put($item['dedup_key'], $item);
            }
        }

        return DB::transaction(function () use ($organization, $desired, $now) {
            Organization::query()->whereKey($organization->getKey())->lockForUpdate()->first();

            return $this->reconcile($organization, $desired, $now);
        });
    }

    /**
     * Ponto de extensão: módulos posteriores (financeiro) registram seus detectores sem mexer nos demais.
     *
     * @var list<callable(Organization, CarbonImmutable, CarbonImmutable, string, array<string, int|bool>): iterable<array<string, mixed>>>
     */
    private static array $extraDetectors = [];

    /** @param callable(Organization, CarbonImmutable, CarbonImmutable, string, array<string, int|bool>): iterable<array<string, mixed>> $detector */
    public static function register(callable $detector): void
    {
        self::$extraDetectors[] = $detector;
    }

    /** @return iterable<array<string, mixed>> */
    private function extra(Organization $organization, CarbonImmutable $now, CarbonImmutable $today, string $timezone, array $config): iterable
    {
        foreach (self::$extraDetectors as $detector) {
            yield from $detector($organization, $now, $today, $timezone, $config);
        }
    }

    /**
     * @param  Collection<string, array<string, mixed>>  $desired
     * @return array{created: int, updated: int, resolved: int, reopened: int, open: int}
     */
    private function reconcile(Organization $organization, Collection $desired, CarbonImmutable $now): array
    {
        $existing = Alert::query()->where('organization_id', $organization->getKey())->get()->keyBy('dedup_key');
        $counts = ['created' => 0, 'updated' => 0, 'resolved' => 0, 'reopened' => 0];

        foreach ($desired as $key => $item) {
            $alert = $existing->get($key);

            if ($alert === null) {
                Alert::create($item + ['organization_id' => $organization->getKey(), 'status' => 'open', 'first_seen_at' => $now, 'last_seen_at' => $now]);
                $counts['created']++;

                continue;
            }

            if ($alert->status === 'resolved') {
                // A pendência voltou: é uma nova ocorrência, então volta como não lida para todos.
                $alert->states()->delete();
                $alert->forceFill(['status' => 'open', 'resolved_at' => null, 'resolved_reason' => null, 'first_seen_at' => $now]);
                $counts['reopened']++;
            }

            $alert->fill($item);
            $dirty = $alert->isDirty();
            $alert->last_seen_at = $now;
            $alert->save();

            if ($dirty && $alert->wasChanged(['title', 'message', 'priority', 'due_on'])) {
                $counts['updated']++;
            }
        }

        foreach ($existing as $key => $alert) {
            if ($alert->status === 'open' && ! $desired->has($key)) {
                $alert->forceFill(['status' => 'resolved', 'resolved_at' => $now, 'resolved_reason' => 'Pendência resolvida'])->save();
                $counts['resolved']++;
            }
        }

        return $counts + ['open' => $desired->count()];
    }

    // ----------------------------------------------------------------- detectores

    /** @return iterable<array<string, mixed>> */
    private function vehicleCrlv(Organization $organization, CarbonImmutable $now, CarbonImmutable $today, string $timezone, array $config): iterable
    {
        $limit = $today->addDays((int) $config['crlv_lead_days'])->toDateString();

        $vehicles = Vehicle::query()
            ->where('organization_id', $organization->getKey())
            ->where('status', 'active')
            ->whereNotNull('crlv_expires_at')
            ->whereDate('crlv_expires_at', '<=', $limit)
            ->get();

        foreach ($vehicles as $vehicle) {
            $expires = CarbonImmutable::parse($vehicle->crlv_expires_at->toDateString(), $timezone);
            $days = (int) $today->diffInDays($expires, false);
            $after = $expires->addDay()->startOfDay()->utc();
            $commitments = count($this->finder->find($organization, $vehicle->getKey(), null, $after));

            $when = match (true) {
                $days < 0 => 'CRLV vencido há '.abs($days).' '.($days === -1 ? 'dia' : 'dias'),
                $days === 0 => 'CRLV vence hoje',
                default => "CRLV vence em {$days} ".($days === 1 ? 'dia' : 'dias'),
            };

            yield $this->item("vehicle:{$vehicle->getKey()}:crlv:{$expires->toDateString()}", $days < 0 ? 'vehicle.crlv_expired' : 'vehicle.crlv_expiring', 'vehicle', [
                'priority' => $commitments > 0 ? 'critical' : ($days <= 7 ? 'high' : 'normal'),
                'title' => "{$when}: {$vehicle->plate}",
                'message' => $commitments > 0
                    ? "{$commitments} ".($commitments === 1 ? 'aula ou exame está agendado' : 'aulas ou exames estão agendados').' depois do vencimento. Atualize o CRLV ou troque o veículo.'
                    : 'Renove o CRLV e atualize a validade do veículo.',
                'subject_type' => 'vehicle',
                'subject_id' => $vehicle->getKey(),
                'due_on' => $expires->toDateString(),
            ]);
        }
    }

    /** @return iterable<array<string, mixed>> */
    private function documents(Organization $organization, CarbonImmutable $now, CarbonImmutable $today, string $timezone, array $config): iterable
    {
        $limit = $today->addDays((int) $config['document_lead_days'])->toDateString();

        $documents = Document::query()
            ->where('organization_id', $organization->getKey())
            ->whereIn('status', ['attached', 'verified'])
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '<=', $limit)
            ->where('type', '!=', 'vehicle_registration')
            ->with('student:id,name')
            ->get();

        foreach ($documents as $document) {
            $expires = CarbonImmutable::parse($document->expires_at->toDateString(), $timezone);
            $days = (int) $today->diffInDays($expires, false);
            $owner = $document->student?->name;
            [$subjectType, $subjectId] = match (true) {
                $document->student_id !== null => ['student', $document->student_id],
                $document->vehicle_id !== null => ['vehicle', $document->vehicle_id],
                default => ['process', $document->qualification_process_id],
            };

            yield $this->item("document:{$document->getKey()}:expires:{$expires->toDateString()}", $days < 0 ? 'document.expired' : 'document.expiring', 'document', [
                'priority' => $days < 0 || $days <= 7 ? 'high' : 'normal',
                'title' => ($days < 0 ? 'Documento vencido' : "Documento vence em {$days} ".($days === 1 ? 'dia' : 'dias')).($owner ? ": {$owner}" : ''),
                'message' => 'Anexe a versão atualizada do documento ('.$this->documentLabel($document->type->value).') e confira-a.',
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'due_on' => $expires->toDateString(),
            ]);
        }
    }

    /** @return iterable<array<string, mixed>> */
    private function maintenance(Organization $organization, CarbonImmutable $now, CarbonImmutable $today, string $timezone, array $config): iterable
    {
        $vehicles = Vehicle::query()
            ->where('organization_id', $organization->getKey())
            ->where('status', 'active')
            ->whereHas('maintenances', fn ($q) => $q->where('status', 'done'))
            ->get();

        foreach ($vehicles as $vehicle) {
            foreach ($this->maintenanceDue->forVehicle($vehicle, $today->toDateString()) as $row) {
                $m = $row['maintenance'];
                $overdue = $row['state'] === 'overdue';
                $parts = [];
                if ($m->next_due_date !== null && in_array('date', $row['reasons'], true)) {
                    $parts[] = 'até '.$m->next_due_date->format('d/m/Y');
                }
                if ($m->next_due_km !== null && in_array('km', $row['reasons'], true)) {
                    $parts[] = 'aos '.number_format($m->next_due_km, 0, ',', '.').' km';
                }

                yield $this->item("maintenance:{$m->getKey()}:{$row['state']}", $overdue ? 'maintenance.overdue' : 'maintenance.due', 'maintenance', [
                    'priority' => $overdue ? 'high' : 'normal',
                    'title' => ($overdue ? 'Revisão vencida' : 'Revisão próxima').": {$m->type} — {$vehicle->plate}",
                    'message' => 'Prevista '.implode(' e ', $parts).'. Agende o serviço e, se precisar, bloqueie a agenda do veículo.',
                    'subject_type' => 'vehicle',
                    'subject_id' => $vehicle->getKey(),
                    'due_on' => $m->next_due_date?->toDateString(),
                ]);
            }
        }
    }

    /** @return iterable<array<string, mixed>> */
    private function blocksWithCommitments(Organization $organization, CarbonImmutable $now, CarbonImmutable $today, string $timezone, array $config): iterable
    {
        $blocks = AvailabilityBlock::query()
            ->where('organization_id', $organization->getKey())
            ->active()
            ->where('ends_at', '>', $now)
            ->with(['vehicle:id,plate', 'instructor:id,full_name'])
            ->get();

        foreach ($blocks as $block) {
            $from = $block->starts_at > $now ? $block->starts_at : $now;
            $affected = $this->finder->find($organization, $block->vehicle_id, $block->instructor_id, $from, $block->ends_at);

            if ($affected === []) {
                continue;
            }

            $soon = collect($affected)->contains(fn ($c) => CarbonImmutable::parse($c['starts_at']) < $now->addHours(48));
            $who = $block->vehicle?->plate ?? $block->instructor?->full_name ?? 'Recurso';

            yield $this->item("block:{$block->getKey()}:affected", 'block.affected', 'block', [
                'priority' => $soon ? 'critical' : 'high',
                'title' => "{$who} bloqueado com ".count($affected).' '.(count($affected) === 1 ? 'compromisso' : 'compromissos').' para resolver',
                'message' => 'Troque o veículo ou instrutor, remarque ou cancele cada aula e exame afetado.',
                'subject_type' => $block->vehicle_id ? 'vehicle' : 'instructor',
                'subject_id' => $block->vehicle_id ?? $block->instructor_id,
                'due_on' => CarbonImmutable::parse($affected[0]['starts_at'])->setTimezone($timezone)->toDateString(),
            ]);
        }
    }

    /** @return iterable<array<string, mixed>> */
    private function releasePending(Organization $organization, CarbonImmutable $now, CarbonImmutable $today, string $timezone, array $config): iterable
    {
        $lessons = Lesson::query()
            ->where('organization_id', $organization->getKey())
            ->where('status', LessonStatus::Scheduled->value)
            ->where('starts_at', '>=', $now)
            ->where('starts_at', '<=', $now->addDays((int) $config['release_lead_days']))
            ->orderBy('starts_at')
            ->get()
            ->groupBy('enrollment_id');

        $enrollments = Enrollment::query()->whereIn('id', $lessons->keys())->with(['process.checklistItems', 'student:id,name'])->get();

        foreach ($enrollments as $enrollment) {
            $pending = $enrollment->process?->pendingRequiredItems() ?? collect();

            if ($pending->isEmpty()) {
                continue;
            }

            $first = $lessons[$enrollment->getKey()]->first();
            $date = $first->starts_at->setTimezone($timezone);

            yield $this->item("enrollment:{$enrollment->getKey()}:release", 'lesson.release_pending', 'lesson', [
                'priority' => $first->starts_at < $now->addHours(48) ? 'high' : 'normal',
                'title' => "Aula sem liberação para a prática: {$enrollment->student?->name}",
                'message' => 'Próxima aula em '.$date->format('d/m \à\s H:i').'. Falta conferir: '.$pending->map(fn ($i) => $i->type->label())->implode(', ').'.',
                'subject_type' => 'enrollment',
                'subject_id' => $enrollment->getKey(),
                'due_on' => $date->toDateString(),
            ]);
        }
    }

    /** @return iterable<array<string, mixed>> */
    private function upcomingExams(Organization $organization, CarbonImmutable $now, CarbonImmutable $today, string $timezone, array $config): iterable
    {
        $exams = PracticalExam::query()
            ->where('organization_id', $organization->getKey())
            ->where('status', 'scheduled')
            ->where('scheduled_at', '>=', $now)
            ->where('scheduled_at', '<=', $now->addDays((int) $config['exam_lead_days'])->endOfDay())
            ->with('student:id,name')
            ->get();

        foreach ($exams as $exam) {
            $date = $exam->scheduled_at->setTimezone($timezone);
            $days = (int) $today->diffInDays($date->startOfDay(), false);

            yield $this->item("exam:{$exam->getKey()}:upcoming", 'exam.upcoming', 'exam', [
                'priority' => $days <= 1 ? 'high' : 'normal',
                'title' => "Exame {$exam->category} ".($days === 0 ? 'hoje' : ($days === 1 ? 'amanhã' : "em {$days} dias")).": {$exam->student?->name}",
                'message' => 'Em '.$date->format('d/m \à\s H:i').($exam->location ? ", {$exam->location}" : '').'. Confira taxa, instrutor e veículo.',
                'audience' => $exam->instructor_id ? 'both' : 'staff',
                'instructor_id' => $exam->instructor_id,
                'subject_type' => 'exam',
                'subject_id' => $exam->getKey(),
                'due_on' => $date->toDateString(),
            ]);
        }
    }

    /** @return iterable<array<string, mixed>> */
    private function missingExamResults(Organization $organization, CarbonImmutable $now, CarbonImmutable $today, string $timezone, array $config): iterable
    {
        $exams = PracticalExam::query()
            ->where('organization_id', $organization->getKey())
            ->where('status', 'scheduled')
            ->whereRaw('DATE_ADD(scheduled_at, INTERVAL '.\App\Models\PracticalExam::SLOT_MINUTES.' MINUTE) < ?', [$now])
            ->with('student:id,name')
            ->limit(300)
            ->get();

        foreach ($exams as $exam) {
            yield $this->item("exam:{$exam->getKey()}:result", 'exam.result_missing', 'exam', [
                'priority' => 'high',
                'title' => "Resultado do exame {$exam->category} não informado: {$exam->student?->name}",
                'message' => 'O exame era em '.$exam->scheduled_at->setTimezone($timezone)->format('d/m \à\s H:i').'. Registre aprovado, reprovado, ausente ou não concluído.',
                'subject_type' => 'exam',
                'subject_id' => $exam->getKey(),
                'due_on' => $exam->scheduled_at->setTimezone($timezone)->toDateString(),
            ]);
        }
    }

    /** @return iterable<array<string, mixed>> */
    private function fees(Organization $organization, CarbonImmutable $now, CarbonImmutable $today, string $timezone, array $config): iterable
    {
        $fees = ExternalFee::query()
            ->where('organization_id', $organization->getKey())
            ->whereIn('status', ['unknown', 'pending', 'payment_reported'])
            ->with(['student:id,name', 'exams' => fn ($q) => $q->where('status', 'scheduled')->select('practical_exams.id', 'scheduled_at')])
            ->get();

        foreach ($fees as $fee) {
            $name = $fee->student?->name;
            $base = ['subject_type' => 'process', 'subject_id' => $fee->qualification_process_id];

            if ($fee->status->value === 'payment_reported') {
                if ($fee->updated_at <= $now->subDays(2)) {
                    yield $this->item("fee:{$fee->getKey()}:unconfirmed", 'fee.unconfirmed', 'fee', $base + [
                        'priority' => 'normal',
                        'title' => "Pagamento da taxa aguardando confirmação: {$name}",
                        'message' => "{$fee->kind}: o pagamento foi informado mas ainda não foi conferido. Confirme a fonte (comprovante não confirma sozinho).",
                    ]);
                }

                continue;
            }

            $due = $fee->due_date ? CarbonImmutable::parse($fee->due_date->toDateString(), $timezone) : null;

            if ($due !== null && $due < $today) {
                yield $this->item("fee:{$fee->getKey()}:overdue", 'fee.overdue', 'fee', $base + [
                    'priority' => 'high',
                    'title' => "Taxa vencida: {$name}",
                    'message' => "{$fee->kind} venceu em ".$due->format('d/m/Y').'. Confirme o pagamento ou emita nova guia.',
                    'due_on' => $due->toDateString(),
                ]);
            } elseif ($due !== null && $due <= $today->addDays((int) $config['fee_lead_days'])) {
                yield $this->item("fee:{$fee->getKey()}:due", 'fee.due', 'fee', $base + [
                    'priority' => 'normal',
                    'title' => "Taxa vence em breve: {$name}",
                    'message' => "{$fee->kind} vence em ".$due->format('d/m/Y').'.',
                    'due_on' => $due->toDateString(),
                ]);
            } elseif ($due === null && $fee->exams->contains(fn ($e) => $e->scheduled_at <= $now->addDays((int) $config['exam_lead_days'] + 4))) {
                yield $this->item("fee:{$fee->getKey()}:exam_pending", 'fee.exam_pending', 'fee', $base + [
                    'priority' => 'high',
                    'title' => "Taxa pendente com exame próximo: {$name}",
                    'message' => "{$fee->kind} ainda não está confirmada e há exame agendado nos próximos dias.",
                ]);
            }
        }
    }

    /** @return iterable<array<string, mixed>> */
    private function issuance(Organization $organization, CarbonImmutable $now, CarbonImmutable $today, string $timezone, array $config): iterable
    {
        $processes = QualificationProcess::query()
            ->where('organization_id', $organization->getKey())
            ->whereIn('issuance_status', ['pending', 'issued'])
            ->whereNotIn('status', ['closed'])
            ->with('student:id,name')
            ->get();

        foreach ($processes as $process) {
            $name = $process->student?->name;

            if ($process->issuance_status->value === 'pending' && $process->updated_at <= $now->subDays(7)) {
                yield $this->item("process:{$process->getKey()}:issuance_pending", 'process.issuance_pending', 'process', [
                    'priority' => 'normal',
                    'title' => "Emissão aguardando conferência: {$name}",
                    'message' => 'Aprovado há mais de 7 dias sem registro da emissão. Confira no sistema oficial e registre a referência.',
                    'subject_type' => 'process',
                    'subject_id' => $process->getKey(),
                ]);
            }

            if ($process->issuance_status->value === 'issued' && ($process->issued_at ?? $process->updated_at) <= $now->subDays(7)) {
                yield $this->item("process:{$process->getKey()}:undelivered", 'process.undelivered', 'process', [
                    'priority' => 'low',
                    'title' => "Documento emitido, entrega pendente: {$name}",
                    'message' => 'Registre a entrega ao aluno para encerrar o processo.',
                    'subject_type' => 'process',
                    'subject_id' => $process->getKey(),
                ]);
            }
        }
    }

    /** @return iterable<array<string, mixed>> */
    private function balances(Organization $organization, CarbonImmutable $now, CarbonImmutable $today, string $timezone, array $config): iterable
    {
        $threshold = (int) $config['low_balance_minutes'];

        $enrollments = Enrollment::query()
            ->where('organization_id', $organization->getKey())
            ->whereIn('status', [EnrollmentStatus::Contracted->value, EnrollmentStatus::InService->value])
            ->where(fn ($q) => $q->whereNull('qualification_process_id')
                ->orWhereHas('process', fn ($p) => $p->whereNotIn('status', ['completed', 'closed'])))
            ->whereHas('packages')
            ->with('student:id,name')
            ->get();

        foreach ($enrollments->chunk(200) as $chunk) {
            foreach ($this->ledger->balancesFor($chunk) as $id => $balance) {
                $enrollment = $chunk->firstWhere('id', $id);
                $available = (int) $balance['available'];

                if ($available > $threshold) {
                    continue;
                }

                $exhausted = $available <= 0;

                yield $this->item("enrollment:{$id}:balance_".($exhausted ? 'exhausted' : 'low'), $exhausted ? 'balance.exhausted' : 'balance.low', 'balance', [
                    'priority' => $exhausted ? 'high' : 'normal',
                    'title' => ($exhausted ? 'Saldo de aulas esgotado' : 'Saldo de aulas baixo').": {$enrollment->student?->name}",
                    'message' => $exhausted
                        ? 'Não há minutos disponíveis. Registre um acréscimo antes de agendar novas aulas.'
                        : "Restam {$available} min. Ofereça um acréscimo de aulas.",
                    'subject_type' => 'enrollment',
                    'subject_id' => $id,
                ]);
            }
        }
    }

    /** @return iterable<array<string, mixed>> */
    private function lessonsWithoutOutcome(Organization $organization, CarbonImmutable $now, CarbonImmutable $today, string $timezone, array $config): iterable
    {
        $lessons = Lesson::query()
            ->where('organization_id', $organization->getKey())
            ->where('status', LessonStatus::Scheduled->value)
            ->where('ends_at', '<', $now->subHours((int) $config['lesson_grace_hours']))
            ->with('enrollment.student:id,name')
            ->orderBy('ends_at')
            ->limit(300)
            ->get();

        foreach ($lessons as $lesson) {
            $date = $lesson->starts_at->setTimezone($timezone);

            yield $this->item("lesson:{$lesson->getKey()}:outcome", 'lesson.no_outcome', 'lesson', [
                'priority' => $lesson->ends_at < $now->subHours(48) ? 'high' : 'normal',
                'title' => 'Aula sem desfecho: '.($lesson->enrollment?->student?->name ?? 'aluno'),
                'message' => 'A aula de '.$date->format('d/m \à\s H:i').' já passou. Registre se foi realizada, falta ou cancelada.',
                'audience' => 'both',
                'instructor_id' => $lesson->instructor_id,
                'subject_type' => 'lesson',
                'subject_id' => $lesson->getKey(),
                'due_on' => $date->toDateString(),
            ]);
        }
    }

    /** @return iterable<array<string, mixed>> */
    private function inactiveStudents(Organization $organization, CarbonImmutable $now, CarbonImmutable $today, string $timezone, array $config): iterable
    {
        $days = (int) $config['inactive_days'];

        $enrollments = Enrollment::query()
            ->where('organization_id', $organization->getKey())
            ->where('status', EnrollmentStatus::InService->value)
            ->whereDoesntHave('lessons', fn ($q) => $q->where('status', LessonStatus::Scheduled->value)->where('ends_at', '>', $now))
            ->whereDoesntHave('lessons', fn ($q) => $q->whereIn('status', ['completed', 'missed'])->where('ends_at', '>', $now->subDays($days)))
            ->where('updated_at', '<=', $now->subDays($days))
            ->with('student:id,name')
            ->limit(300)
            ->get();

        foreach ($enrollments as $enrollment) {
            yield $this->item("enrollment:{$enrollment->getKey()}:inactive", 'student.inactive', 'student', [
                'priority' => 'low',
                'title' => "Aluno sem aula há mais de {$days} dias: {$enrollment->student?->name}",
                'message' => 'Entre em contato e agende a próxima aula, ou atualize a situação da matrícula.',
                'subject_type' => 'enrollment',
                'subject_id' => $enrollment->getKey(),
            ]);
        }
    }

    // ----------------------------------------------------------------- utilidades

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function item(string $key, string $kind, string $category, array $data): array
    {
        return $data + [
            'dedup_key' => $key,
            'kind' => $kind,
            'category' => $category,
            'audience' => 'staff',
            'instructor_id' => null,
            'message' => null,
            'subject_type' => null,
            'subject_id' => null,
            'due_on' => null,
        ];
    }

    private function documentLabel(string $type): string
    {
        return match ($type) {
            'identity' => 'identidade', 'current_license' => 'CNH atual', 'proof_of_residence' => 'comprovante de residência',
            'learning_license' => 'licença de aprendizagem', 'assessment_result' => 'resultado de avaliação',
            'payment_guide' => 'guia de pagamento', 'contract' => 'contrato',
            default => 'documento',
        };
    }
}
