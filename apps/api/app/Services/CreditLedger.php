<?php

namespace App\Services;

use App\Enums\CreditBucket;
use App\Enums\CreditEntryType;
use App\Enums\LessonStatus;
use App\Enums\LicenseCategory;
use App\Exceptions\BusinessRuleException;
use App\Models\CreditEntry;
use App\Models\Enrollment;
use App\Models\EnrollmentPackage;
use App\Models\Lesson;
use App\Models\Vehicle;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Livro-razão de minutos por matrícula. Regras centrais:
 * - O saldo é SEMPRE calculado sobre todos os movimentos; nada é gravado como total.
 * - Movimentos são append-only; correção = ajuste ou estorno (movimento compensatório).
 * - Reserva, liberação e consumo de uma aula usam chave de deduplicação única (lesson:ID:tipo),
 *   então repetição, duplo clique ou requisições concorrentes nunca descontam duas vezes.
 * - Minutos "realizados" vêm das aulas concluídas; consumo cobrado (falta/cancelamento tardio)
 *   é consumo comercial e nunca entra nos minutos de instrução realizados.
 *
 * Os métodos de escrita devem rodar dentro de uma transação, com a matrícula/aula já travadas.
 */
class CreditLedger
{
    public function __construct(private readonly Audit $audit) {}

    // ----------------------------------------------------------------- leitura

    /**
     * @param  Collection<int, Enrollment>|list<Enrollment>  $enrollments
     * @return array<int, array<string, mixed>> saldo por id de matrícula
     */
    public function balancesFor(iterable $enrollments): array
    {
        $enrollments = collect($enrollments)->keyBy('id');

        if ($enrollments->isEmpty()) {
            return [];
        }

        $ids = $enrollments->keys()->all();

        $entries = CreditEntry::query()
            ->whereIn('enrollment_id', $ids)
            ->select('enrollment_id', 'bucket', 'category', DB::raw('SUM(minutes) as total'))
            ->groupBy('enrollment_id', 'bucket', 'category')
            ->get()
            ->groupBy('enrollment_id');

        $realized = Lesson::query()
            ->whereIn('enrollment_id', $ids)
            ->where('status', LessonStatus::Completed->value)
            ->select('enrollment_id', 'category', DB::raw('SUM(COALESCE(actual_minutes, TIMESTAMPDIFF(MINUTE, starts_at, ends_at))) as total'))
            ->groupBy('enrollment_id', 'category')
            ->get()
            ->groupBy('enrollment_id');

        $packages = EnrollmentPackage::query()
            ->whereIn('enrollment_id', $ids)
            ->orderBy('id')
            ->get()
            ->groupBy('enrollment_id');

        $result = [];

        foreach ($enrollments as $id => $enrollment) {
            $rows = [];
            foreach ($entries->get($id, collect()) as $row) {
                $key = $row->category ?? '';
                $rows[$key] ??= ['contracted' => 0, 'reserved' => 0, 'consumed' => 0, 'realized' => 0];
                $field = ['credit' => 'contracted', 'reserve' => 'reserved', 'consume' => 'consumed'][$row->bucket->value];
                $rows[$key][$field] += (int) $row->total;
            }
            foreach ($realized->get($id, collect()) as $row) {
                $key = $row->category ?? '';
                $rows[$key] ??= ['contracted' => 0, 'reserved' => 0, 'consumed' => 0, 'realized' => 0];
                $rows[$key]['realized'] += (int) $row->total;
            }

            $result[$id] = $this->summarize($enrollment, $rows, $packages->get($id, collect()));
        }

        return $result;
    }

    /** @return array<string, mixed> */
    public function balanceFor(Enrollment $enrollment): array
    {
        return $this->balancesFor([$enrollment])[$enrollment->getKey()];
    }

    /**
     * @param  array<string, array{contracted: int, reserved: int, consumed: int, realized: int}>  $rows
     * @param  Collection<int, EnrollmentPackage>  $packages
     * @return array<string, mixed>
     */
    private function summarize(Enrollment $enrollment, array $rows, Collection $packages): array
    {
        $total = ['contracted' => 0, 'reserved' => 0, 'consumed' => 0, 'realized' => 0];
        foreach ($rows as $row) {
            foreach ($total as $field => $_) {
                $total[$field] += $row[$field];
            }
        }
        $total['available'] = $total['contracted'] - $total['reserved'] - $total['consumed'];

        $reference = $packages->reverse()->first(fn (EnrollmentPackage $p) => $p->reference_minutes !== null)?->reference_minutes;
        $policy = $this->currentPolicy($packages);

        $byCategory = [];
        if (! $enrollment->category->isSimple()) {
            $keys = array_unique(array_merge(
                array_map(fn (LicenseCategory $c) => $c->value, $enrollment->category->components()),
                array_keys($rows),
            ));
            foreach ($keys as $key) {
                $row = $rows[$key] ?? ['contracted' => 0, 'reserved' => 0, 'consumed' => 0, 'realized' => 0];
                $byCategory[] = ['category' => $key === '' ? null : $key] + $row
                    + ['available' => $row['contracted'] - $row['reserved'] - $row['consumed']];
            }
        }

        return $total + [
            'has_package' => $packages->isNotEmpty() || $total['contracted'] > 0,
            'reference_minutes' => $reference,
            'equivalent_lessons' => $reference ? round($total['available'] / $reference, 2) : null,
            'by_category' => $byCategory,
            'policy' => $policy,
        ];
    }

    /**
     * Política vigente = a do pacote mais recente da matrícula.
     *
     * @param  Collection<int, EnrollmentPackage>  $packages
     * @return array<string, mixed>|null
     */
    private function currentPolicy(Collection $packages): ?array
    {
        $package = $packages->last();

        return $package === null ? null : [
            'consume_basis' => $package->consume_basis,
            'absence_charge' => $package->absence_charge,
            'late_cancel_charge' => $package->late_cancel_charge,
            'cancel_notice_hours' => $package->cancel_notice_hours,
        ];
    }

    // ----------------------------------------------------------------- contratação e ajustes

    /**
     * @param  array{description: string, minutes: int, reference_minutes?: ?int, price_cents?: ?int, category?: ?string, kind?: string, consume_basis?: string, absence_charge?: string, late_cancel_charge?: string, cancel_notice_hours?: ?int}  $data
     */
    public function grant(Enrollment $enrollment, array $data): EnrollmentPackage
    {
        $category = $this->creditCategory($enrollment, $data['category'] ?? null);

        $package = EnrollmentPackage::create([
            'organization_id' => $enrollment->organization_id,
            'enrollment_id' => $enrollment->getKey(),
            'kind' => $data['kind'] ?? 'contract',
            'category' => $category,
            'description' => $data['description'],
            'minutes' => $data['minutes'],
            'reference_minutes' => $data['reference_minutes'] ?? null,
            'price_cents' => $data['price_cents'] ?? null,
            'consume_basis' => $data['consume_basis'] ?? 'actual',
            'absence_charge' => $data['absence_charge'] ?? 'none',
            'late_cancel_charge' => $data['late_cancel_charge'] ?? 'none',
            'cancel_notice_hours' => $data['cancel_notice_hours'] ?? null,
            'created_by' => auth()->id(),
        ]);

        $this->entry($enrollment, CreditBucket::Credit, CreditEntryType::Grant, $data['minutes'], [
            'package_id' => $package->getKey(),
            'category' => $category,
            'reason' => $data['description'],
        ]);

        $this->audit->record($enrollment->organization_id, 'balance.grant',
            "Contratação de {$data['minutes']} min registrada: {$data['description']}", [
                'enrollment_id' => $enrollment->getKey(),
                'student_id' => $enrollment->student_id,
                'process_id' => $enrollment->qualification_process_id,
                'subject' => $package,
                'changes' => ['minutes' => $data['minutes'], 'category' => $category, 'price_cents' => $data['price_cents'] ?? null],
            ]);

        return $package;
    }

    public function adjust(Enrollment $enrollment, int $minutes, ?string $category, string $reason): CreditEntry
    {
        if ($minutes === 0) {
            throw new BusinessRuleException('Informe uma quantidade de minutos diferente de zero.', 'invalid_adjustment', 422);
        }

        $category = $this->creditCategory($enrollment, $category);
        $balance = $this->balanceFor($enrollment);

        if ($minutes < 0 && $balance['available'] + $minutes < 0) {
            throw new BusinessRuleException(
                'O ajuste deixaria o saldo disponível negativo. Estorne consumos ou cancele reservas antes.',
                'adjustment_exceeds_balance',
                422,
            );
        }

        $entry = $this->entry($enrollment, CreditBucket::Credit, CreditEntryType::Adjustment, $minutes, [
            'category' => $category,
            'reason' => $reason,
        ]);

        $this->audit->record($enrollment->organization_id, 'balance.adjustment',
            'Ajuste manual de '.($minutes > 0 ? '+' : '')."{$minutes} min no saldo.", [
                'enrollment_id' => $enrollment->getKey(),
                'student_id' => $enrollment->student_id,
                'process_id' => $enrollment->qualification_process_id,
                'reason' => $reason,
                'subject' => $entry,
                'changes' => ['minutes' => $minutes, 'category' => $category],
            ]);

        return $entry;
    }

    /**
     * Estorno: cria um movimento compensatório e preserva o original.
     */
    public function reverse(Enrollment $enrollment, CreditEntry $original, string $reason): CreditEntry
    {
        $reversible = [
            CreditEntryType::Grant, CreditEntryType::InitialBalance, CreditEntryType::Adjustment,
            CreditEntryType::Consume, CreditEntryType::ConsumeAdjustment,
        ];

        if (! in_array($original->type, $reversible, true)) {
            throw new BusinessRuleException('Este movimento não pode ser estornado.', 'entry_not_reversible', 422);
        }

        $key = "entry:{$original->getKey()}:reversal";

        if (CreditEntry::query()->where('dedupe_key', $key)->exists()) {
            throw new BusinessRuleException('Este movimento já foi estornado.', 'entry_already_reversed', 409);
        }

        if ($original->bucket === CreditBucket::Credit
            && $this->balanceFor($enrollment)['available'] - $original->minutes < 0) {
            throw new BusinessRuleException(
                'O estorno deixaria o saldo disponível negativo. Cancele reservas ou estorne consumos antes.',
                'reversal_exceeds_balance',
                422,
            );
        }

        $entry = $this->entry($enrollment, $original->bucket, CreditEntryType::Reversal, -$original->minutes, [
            'category' => $original->category,
            'lesson_id' => $original->lesson_id,
            'package_id' => $original->package_id,
            'reverses_entry_id' => $original->getKey(),
            'reason' => $reason,
            'dedupe_key' => $key,
        ]);

        $this->audit->record($enrollment->organization_id, 'balance.reversal',
            "Estorno de {$original->type->label()} ({$original->minutes} min).", [
                'enrollment_id' => $enrollment->getKey(),
                'student_id' => $enrollment->student_id,
                'process_id' => $enrollment->qualification_process_id,
                'reason' => $reason,
                'subject' => $entry,
                'changes' => ['reverses_entry_id' => $original->getKey(), 'minutes' => -$original->minutes],
            ]);

        return $entry;
    }

    // ----------------------------------------------------------------- aulas

    /**
     * Categoria simples da aula. Matrícula conjunta (AB...) usa a do veículo ou a informada.
     */
    public function lessonCategory(Enrollment $enrollment, ?Vehicle $vehicle, ?string $requested): ?string
    {
        if ($enrollment->category->isSimple()) {
            return $enrollment->category->value;
        }

        $category = $vehicle?->category->value ?? $requested;

        if ($category !== null && ! in_array($category, array_map(fn ($c) => $c->value, $enrollment->category->components()), true)) {
            throw new BusinessRuleException('A categoria da aula não faz parte desta matrícula.', 'lesson_category_invalid', 422);
        }

        return $category;
    }

    /**
     * Confere o saldo antes de reservar. Matrícula sem pacote = aula avulsa (aviso). Com pacote e
     * saldo insuficiente, bloqueia, salvo exceção autorizada com motivo.
     *
     * @return list<array{code: string, message: string}> avisos
     */
    public function assertCanReserve(Enrollment $enrollment, ?string $category, int $minutes, ?string $overrideReason): array
    {
        $balance = $this->balanceFor($enrollment);

        if (! $balance['has_package']) {
            return [['code' => 'no_package', 'message' => 'Matrícula sem pacote: aula avulsa, sem saldo contratado.']];
        }

        $available = $balance['available'];
        if ($category !== null && $balance['by_category'] !== []) {
            $row = collect($balance['by_category'])->firstWhere('category', $category);
            $available = $row['available'] ?? 0;
        }

        if ($available >= $minutes) {
            return [];
        }

        if ($overrideReason === null || trim($overrideReason) === '') {
            throw new BusinessRuleException(
                "Saldo insuficiente: disponível {$available} min, necessário {$minutes} min. Contrate mais aulas ou autorize a exceção informando o motivo.",
                'insufficient_balance',
                422,
            );
        }

        return [['code' => 'insufficient_balance_override', 'message' => "Exceção autorizada com saldo insuficiente ({$available} min disponíveis)."]];
    }

    public function reserve(Lesson $lesson, ?string $overrideReason = null): void
    {
        $enrollment = $lesson->enrollment;

        $this->entry($enrollment, CreditBucket::Reserve, CreditEntryType::Reserve, $lesson->scheduledMinutes(), [
            'lesson_id' => $lesson->getKey(),
            'category' => $lesson->category,
            'reason' => $overrideReason ? "Exceção autorizada: {$overrideReason}" : 'Aula agendada.',
            'dedupe_key' => "lesson:{$lesson->getKey()}:reserve",
        ]);

        if ($overrideReason) {
            $this->audit->record($lesson->organization_id, 'balance.override',
                'Aula agendada com saldo insuficiente (exceção autorizada).', [
                    'enrollment_id' => $enrollment->getKey(),
                    'student_id' => $enrollment->student_id,
                    'process_id' => $enrollment->qualification_process_id,
                    'reason' => $overrideReason,
                    'subject' => $lesson,
                ]);
        }
    }

    /**
     * Remarcação transfere a reserva: ajusta somente a diferença de duração, nunca cria outra reserva.
     */
    public function syncReservation(Lesson $lesson): void
    {
        $net = $this->lessonNet($lesson, CreditBucket::Reserve);

        if ($net === 0) {
            return;
        }

        $diff = $lesson->scheduledMinutes() - $net;

        if ($diff !== 0) {
            $this->entry($lesson->enrollment, CreditBucket::Reserve, CreditEntryType::ReserveAdjust, $diff, [
                'lesson_id' => $lesson->getKey(),
                'category' => $lesson->category,
                'reason' => 'Remarcação com nova duração.',
            ]);
        }
    }

    /**
     * Encerra a reserva da aula e aplica o consumo que a situação exige (idempotente).
     */
    public function settle(Lesson $lesson, LessonStatus $status): void
    {
        $enrollment = $lesson->enrollment;
        $reserved = $this->lessonNet($lesson, CreditBucket::Reserve);

        if ($reserved !== 0) {
            $this->entry($enrollment, CreditBucket::Reserve, CreditEntryType::Release, -$reserved, [
                'lesson_id' => $lesson->getKey(),
                'category' => $lesson->category,
                'reason' => match ($status) {
                    LessonStatus::Completed => 'Aula realizada: reserva convertida em consumo.',
                    LessonStatus::Missed => 'Falta: reserva liberada.',
                    default => 'Aula cancelada: reserva liberada.',
                },
                'dedupe_key' => "lesson:{$lesson->getKey()}:release",
            ]);
        }

        [$minutes, $reason] = $this->consumption($lesson, $status);

        if ($minutes > 0) {
            $this->entry($enrollment, CreditBucket::Consume, CreditEntryType::Consume, $minutes, [
                'lesson_id' => $lesson->getKey(),
                'category' => $lesson->category,
                'reason' => $reason,
                'dedupe_key' => "lesson:{$lesson->getKey()}:consume",
            ]);
        }
    }

    /**
     * Ajuste de duração real de aula realizada: grava só a diferença, com rastro no extrato.
     */
    public function adjustConsumption(Lesson $lesson, int $previousMinutes): void
    {
        $policy = $this->policyFor($lesson->enrollment);

        if (($policy['consume_basis'] ?? 'actual') !== 'actual') {
            return;
        }

        $target = $lesson->actual_minutes ?? $lesson->scheduledMinutes();
        $net = $this->lessonNet($lesson, CreditBucket::Consume);
        $diff = $target - $net;

        if ($diff === 0) {
            return;
        }

        $this->entry($lesson->enrollment, CreditBucket::Consume, CreditEntryType::ConsumeAdjustment, $diff, [
            'lesson_id' => $lesson->getKey(),
            'category' => $lesson->category,
            'reason' => "Ajuste da duração real da aula: {$previousMinutes} → {$target} min.",
        ]);

        $this->audit->record($lesson->organization_id, 'balance.consumption_adjusted',
            "Duração real da aula ajustada ({$previousMinutes} → {$target} min); consumo corrigido em {$diff} min.", [
                'enrollment_id' => $lesson->enrollment_id,
                'student_id' => $lesson->enrollment->student_id,
                'process_id' => $lesson->enrollment->qualification_process_id,
                'subject' => $lesson,
                'changes' => ['actual_minutes' => ['from' => $previousMinutes, 'to' => $target]],
            ]);
    }

    /**
     * @return array{0: int, 1: string}
     */
    private function consumption(Lesson $lesson, LessonStatus $status): array
    {
        $policy = $this->policyFor($lesson->enrollment);

        return match ($status) {
            LessonStatus::Completed => [
                ($policy['consume_basis'] ?? 'actual') === 'scheduled'
                    ? $lesson->scheduledMinutes()
                    : ($lesson->actual_minutes ?? $lesson->scheduledMinutes()),
                'Aula realizada.',
            ],
            LessonStatus::Missed => ($policy['absence_charge'] ?? 'none') === 'full'
                ? [$lesson->scheduledMinutes(), 'Falta cobrada conforme o contrato (não conta como instrução realizada).']
                : [0, ''],
            LessonStatus::Cancelled => $this->lateCancellation($lesson, $policy)
                ? [$lesson->scheduledMinutes(), 'Cancelamento fora do aviso prévio, cobrado conforme o contrato.']
                : [0, ''],
            default => [0, ''],
        };
    }

    /** @param array<string, mixed>|null $policy */
    private function lateCancellation(Lesson $lesson, ?array $policy): bool
    {
        if (($policy['late_cancel_charge'] ?? 'none') !== 'full' || ($policy['cancel_notice_hours'] ?? null) === null) {
            return false;
        }

        return now()->diffInMinutes($lesson->starts_at, false) < $policy['cancel_notice_hours'] * 60;
    }

    /** @return array<string, mixed>|null */
    private function policyFor(Enrollment $enrollment): ?array
    {
        $package = EnrollmentPackage::query()->where('enrollment_id', $enrollment->getKey())->orderByDesc('id')->first();

        return $package ? [
            'consume_basis' => $package->consume_basis,
            'absence_charge' => $package->absence_charge,
            'late_cancel_charge' => $package->late_cancel_charge,
            'cancel_notice_hours' => $package->cancel_notice_hours,
        ] : null;
    }

    private function lessonNet(Lesson $lesson, CreditBucket $bucket): int
    {
        return (int) CreditEntry::query()
            ->where('lesson_id', $lesson->getKey())
            ->where('bucket', $bucket->value)
            ->sum('minutes');
    }

    // ----------------------------------------------------------------- internos

    /**
     * Categoria de um crédito: matrícula simples usa a própria; conjunta (AB) exige A ou B,
     * exceto saldo legado sem categoria, que aparece como "a distribuir".
     */
    private function creditCategory(Enrollment $enrollment, ?string $category): ?string
    {
        if ($enrollment->category->isSimple()) {
            return $enrollment->category->value;
        }

        if ($category === null) {
            return null;
        }

        if (! in_array($category, array_map(fn ($c) => $c->value, $enrollment->category->components()), true)) {
            throw new BusinessRuleException('A categoria informada não faz parte desta matrícula.', 'credit_category_invalid', 422);
        }

        return $category;
    }

    /**
     * Grava o movimento. Com chave de deduplicação, repetir a operação não duplica o movimento.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function entry(Enrollment $enrollment, CreditBucket $bucket, CreditEntryType $type, int $minutes, array $attributes = []): CreditEntry
    {
        if (DB::transactionLevel() === 0) {
            throw new \LogicException('Movimentos de saldo devem ser gravados dentro de uma transação.');
        }

        if (isset($attributes['dedupe_key'])) {
            $existing = CreditEntry::query()->where('dedupe_key', $attributes['dedupe_key'])->first();

            if ($existing) {
                return $existing;
            }
        }

        return CreditEntry::create($attributes + [
            'organization_id' => $enrollment->organization_id,
            'enrollment_id' => $enrollment->getKey(),
            'bucket' => $bucket,
            'type' => $type,
            'minutes' => $minutes,
            'actor_id' => auth()->id(),
            'occurred_at' => now(),
        ]);
    }
}
