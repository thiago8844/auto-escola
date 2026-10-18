<?php

namespace App\Services\Finance;

use App\Exceptions\BusinessRuleException;
use App\Models\ExternalFee;
use App\Models\FinanceAccount;
use App\Models\FinanceCategory;
use App\Models\FinanceEntry;
use App\Models\FinanceInstallment;
use App\Models\FinanceMovement;
use App\Models\FinancePayment;
use App\Models\FinancePaymentMethod;
use App\Models\FinanceReconciliation;
use App\Models\FinanceTransfer;
use App\Models\Organization;
use App\Services\Audit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

/**
 * Regras do financeiro básico. Tudo em centavos, dentro de transações, com a parcela travada (`FOR UPDATE`) antes de
 * qualquer baixa: duas baixas simultâneas na mesma parcela se enfileiram e a segunda enxerga o saldo já abatido.
 *
 * Movimentos de caixa só nascem quando o dinheiro de fato entra/sai (`confirmed`). Cartão e boleto ficam `pending`
 * (previsão) até a confirmação. Estorno nunca apaga: gera o movimento oposto e mantém o original.
 */
class FinanceService
{
    public function __construct(private readonly Audit $audit, private readonly InstallmentPlanner $planner) {}

    public function today(Organization $organization): CarbonImmutable
    {
        return CarbonImmutable::now($organization->timezone ?: config('autoescola.default_timezone'))->startOfDay();
    }

    // ----------------------------------------------------------------------------------- lançamentos

    /**
     * @param  array<string, mixed>  $data
     */
    public function createEntry(Organization $organization, array $data): FinanceEntry
    {
        $category = $this->category($organization, (int) $data['category_id'], $data['type'] === 'receivable' ? 'income' : 'expense');

        $installments = isset($data['installments'])
            ? $this->planner->validate((int) $data['total_cents'], $data['installments'])
            : $this->planner->plan((int) $data['total_cents'], (int) ($data['plan']['count'] ?? 1), $data['plan']['first_due'] ?? $data['issued_on'], $data['plan']['periodicity'] ?? 'monthly');

        try {
            return DB::transaction(function () use ($organization, $data, $category, $installments) {
                if (! empty($data['source_ref']) && ($existing = $this->findBySourceRef($organization, $data['source_ref'])) !== null) {
                    throw new BusinessRuleException('Este lançamento já existe.', 'entry_already_exists', 409);
                }

                $entry = FinanceEntry::create([
                    'organization_id' => $organization->getKey(),
                    'type' => $data['type'],
                    'description' => $data['description'],
                    'category_id' => $category->getKey(),
                    'student_id' => $data['student_id'] ?? null,
                    'partner_id' => $data['partner_id'] ?? null,
                    'party_id' => $data['party_id'] ?? null,
                    'enrollment_id' => $data['enrollment_id'] ?? null,
                    'vehicle_id' => $data['vehicle_id'] ?? null,
                    'maintenance_id' => $data['maintenance_id'] ?? null,
                    'external_fee_id' => $data['external_fee_id'] ?? null,
                    'recurrence_id' => $data['recurrence_id'] ?? null,
                    'source_ref' => $data['source_ref'] ?? null,
                    'total_cents' => (int) $data['total_cents'],
                    'issued_on' => $data['issued_on'],
                    'installments_count' => count($installments),
                    'notes' => $data['notes'] ?? null,
                    'created_by' => auth()->id(),
                ]);

                foreach ($installments as $row) {
                    FinanceInstallment::create($row + ['organization_id' => $organization->getKey(), 'entry_id' => $entry->getKey()]);
                }

                $this->audit->record($organization->getKey(), 'finance.entry_created', ($entry->isReceivable() ? 'A receber' : 'A pagar').": {$entry->description} (".$this->money($entry->total_cents).', '.count($installments).'x).', [
                    'subject' => $entry,
                    'student_id' => $entry->student_id,
                    'enrollment_id' => $entry->enrollment_id,
                    'changes' => ['total_cents' => $entry->total_cents, 'installments' => count($installments), 'source_ref' => $entry->source_ref],
                ]);

                if (! empty($data['paid'])) {
                    foreach ($entry->installments()->get() as $installment) {
                        $this->recordPayments($organization, $installment, [[
                            'account_id' => $data['paid']['account_id'],
                            'method_id' => $data['paid']['method_id'],
                            'paid_on' => $data['paid']['paid_on'] ?? $this->today($organization)->toDateString(),
                            'applied_cents' => $installment->amount_cents,
                            'reference' => $data['paid']['reference'] ?? null,
                        ]]);
                    }
                }

                return $entry->load('installments');
            });
        } catch (UniqueConstraintViolationException) {
            throw new BusinessRuleException('Este lançamento já existe.', 'entry_already_exists', 409);
        }
    }

    public function findBySourceRef(Organization $organization, string $sourceRef): ?FinanceEntry
    {
        return FinanceEntry::query()->where('organization_id', $organization->getKey())->where('source_ref', $sourceRef)->first();
    }

    /** @param array<string, mixed> $data */
    public function updateEntry(FinanceEntry $entry, array $data): FinanceEntry
    {
        if ($entry->status === 'cancelled') {
            throw new BusinessRuleException('Lançamento cancelado não pode ser alterado.', 'entry_cancelled', 422);
        }

        if (isset($data['category_id'])) {
            $this->category($entry->organization_id, (int) $data['category_id'], $entry->isReceivable() ? 'income' : 'expense');
        }

        $entry->fill(array_intersect_key($data, array_flip(['description', 'category_id', 'notes', 'student_id', 'partner_id', 'party_id'])));
        $changes = $entry->getDirty();
        $entry->save();

        if ($changes !== []) {
            $this->audit->record($entry->organization_id, 'finance.entry_updated', "Lançamento corrigido: {$entry->description}.", ['subject' => $entry, 'changes' => $changes]);
        }

        return $entry;
    }

    /** @param array{due_date?: string, amount_cents?: int} $data */
    public function updateInstallment(FinanceInstallment $installment, array $data): FinanceInstallment
    {
        return DB::transaction(function () use ($installment, $data) {
            $current = FinanceInstallment::query()->whereKey($installment->getKey())->lockForUpdate()->firstOrFail();

            if ($current->status === 'cancelled') {
                throw new BusinessRuleException('Parcela cancelada não pode ser alterada.', 'installment_cancelled', 422);
            }

            if ($this->hasActivePayments($current)) {
                throw new BusinessRuleException('Esta parcela já tem pagamentos. Estorne os pagamentos antes de alterar o valor ou o vencimento: o que já foi recebido não é modificado.', 'installment_has_payments', 422);
            }

            $before = ['due_date' => $current->due_date->toDateString(), 'amount_cents' => $current->amount_cents];
            $current->fill(array_intersect_key($data, array_flip(['due_date', 'amount_cents'])))->save();
            $this->refreshEntryTotal($current->entry);

            $this->audit->record($current->organization_id, 'finance.installment_updated', "Parcela {$current->number} corrigida.", [
                'subject' => $current, 'changes' => ['from' => $before, 'to' => ['due_date' => $current->due_date->toDateString(), 'amount_cents' => $current->amount_cents]],
            ]);

            return $current;
        });
    }

    public function cancelInstallment(FinanceInstallment $installment, string $reason): FinanceInstallment
    {
        return DB::transaction(function () use ($installment, $reason) {
            $current = FinanceInstallment::query()->whereKey($installment->getKey())->lockForUpdate()->firstOrFail();

            if ($current->status === 'cancelled') {
                return $current;
            }

            if ($this->hasActivePayments($current)) {
                throw new BusinessRuleException('Esta parcela tem pagamentos. Estorne-os antes de cancelar.', 'installment_has_payments', 422);
            }

            $current->forceFill(['status' => 'cancelled'])->save();
            $entry = $current->entry;
            $this->refreshEntryTotal($entry);

            if (! $entry->installments()->where('status', '!=', 'cancelled')->exists()) {
                $entry->forceFill(['status' => 'cancelled', 'cancelled_at' => now(), 'cancelled_by' => auth()->id(), 'cancel_reason' => $reason])->save();
            }

            $this->audit->record($current->organization_id, 'finance.installment_cancelled', "Parcela {$current->number} cancelada: {$entry->description}.", ['subject' => $current, 'reason' => $reason]);

            return $current;
        });
    }

    public function cancelEntry(FinanceEntry $entry, string $reason): FinanceEntry
    {
        return DB::transaction(function () use ($entry, $reason) {
            $current = FinanceEntry::query()->whereKey($entry->getKey())->lockForUpdate()->firstOrFail();

            if ($current->status === 'cancelled') {
                return $current;
            }

            $installments = $current->installments()->lockForUpdate()->get();

            foreach ($installments as $installment) {
                if ($this->hasActivePayments($installment)) {
                    throw new BusinessRuleException('Há parcelas com pagamentos. Estorne os pagamentos antes de cancelar o lançamento.', 'entry_has_payments', 422);
                }
            }

            $current->installments()->update(['status' => 'cancelled']);
            $current->forceFill(['status' => 'cancelled', 'cancelled_at' => now(), 'cancelled_by' => auth()->id(), 'cancel_reason' => $reason])->save();

            $this->audit->record($current->organization_id, 'finance.entry_cancelled', "Lançamento cancelado: {$current->description}.", ['subject' => $current, 'reason' => $reason, 'student_id' => $current->student_id]);

            return $current;
        });
    }

    // ----------------------------------------------------------------------------------- baixas

    /**
     * Registra uma ou mais baixas (forma/conta/data diferentes) da mesma parcela, de uma vez.
     *
     * @param  list<array<string, mixed>>  $payments
     * @return list<FinancePayment>
     */
    public function recordPayments(Organization $organization, FinanceInstallment $installment, array $payments): array
    {
        return DB::transaction(function () use ($organization, $installment, $payments) {
            $current = FinanceInstallment::query()->whereKey($installment->getKey())->lockForUpdate()->firstOrFail();
            $entry = FinanceEntry::query()->whereKey($current->entry_id)->firstOrFail();
            $today = $this->today($organization);
            $created = [];

            if ($current->status === 'cancelled' || $entry->status === 'cancelled') {
                throw new BusinessRuleException('Esta parcela está cancelada.', 'installment_cancelled', 422);
            }

            foreach ($payments as $data) {
                if (! empty($data['client_ref'])
                    && ($duplicate = FinancePayment::query()->where('organization_id', $organization->getKey())->where('client_ref', $data['client_ref'])->first()) !== null) {
                    // Repetição do mesmo envio: devolve a baixa já registrada, sem lançar de novo.
                    $created[] = $duplicate;

                    continue;
                }

                $account = FinanceAccount::query()->where('organization_id', $organization->getKey())->findOrFail($data['account_id']);
                $method = FinancePaymentMethod::query()->where('organization_id', $organization->getKey())->findOrFail($data['method_id']);

                if (! $account->active || ! $method->active) {
                    throw new BusinessRuleException('Conta ou forma de pagamento inativa. Escolha outra.', 'finance_inactive', 422);
                }

                $paidOn = CarbonImmutable::parse($data['paid_on'])->startOfDay();

                if ($paidOn > $today) {
                    throw new BusinessRuleException('A data do pagamento não pode ser futura. Para algo que ainda vai acontecer, deixe a parcela em aberto.', 'payment_in_future', 422);
                }

                if ($paidOn < CarbonImmutable::parse($account->opening_date->toDateString())) {
                    throw new BusinessRuleException('A data é anterior ao saldo inicial desta conta ('.$account->opening_date->format('d/m/Y').').', 'payment_before_opening', 422);
                }

                $applied = (int) $data['applied_cents'];
                $discount = (int) ($data['discount_cents'] ?? 0);
                $interest = (int) ($data['interest_cents'] ?? 0);
                $fine = (int) ($data['fine_cents'] ?? 0);
                $fee = (int) ($data['fee_cents'] ?? 0);

                if ($applied < 1) {
                    throw new BusinessRuleException('Informe o valor pago.', 'payment_amount_invalid', 422);
                }

                if (($discount + $interest + $fine + $fee) > 0 && trim((string) ($data['adjust_reason'] ?? '')) === '') {
                    throw new BusinessRuleException('Informe o motivo do desconto, juros, multa ou taxa.', 'adjust_reason_required', 422);
                }

                if ($fee > $applied + $interest + $fine) {
                    throw new BusinessRuleException('A taxa de pagamento não pode ser maior que o valor recebido.', 'payment_fee_invalid', 422);
                }

                $outstanding = $current->amount_cents - $current->paid_cents;

                if ($applied + $discount > $outstanding) {
                    throw new BusinessRuleException(
                        $outstanding === 0
                            ? 'Esta parcela já está quitada.'
                            : 'O valor (com desconto) passa do que falta pagar nesta parcela: '.$this->money($outstanding).'.',
                        'payment_exceeds_balance',
                        422,
                    );
                }

                $pending = $method->settlement_days > 0;

                $payment = FinancePayment::create([
                    'organization_id' => $organization->getKey(),
                    'installment_id' => $current->getKey(),
                    'account_id' => $account->getKey(),
                    'method_id' => $method->getKey(),
                    'status' => $pending ? 'pending' : 'confirmed',
                    'paid_on' => $paidOn->toDateString(),
                    'expected_on' => $pending ? $paidOn->addDays($method->settlement_days)->toDateString() : null,
                    'settled_on' => $pending ? null : $paidOn->toDateString(),
                    'applied_cents' => $applied,
                    'discount_cents' => $discount,
                    'interest_cents' => $interest,
                    'fine_cents' => $fine,
                    'fee_cents' => $fee,
                    'adjust_reason' => $data['adjust_reason'] ?? null,
                    'reference' => $data['reference'] ?? null,
                    'notes' => $data['notes'] ?? null,
                    'client_ref' => $data['client_ref'] ?? null,
                    'created_by' => auth()->id(),
                    'confirmed_by' => $pending ? null : auth()->id(),
                ]);

                if (! $pending) {
                    $this->postMovements($payment, $entry, $current, $paidOn);
                }

                $current->paid_cents += $applied + $discount;
                $created[] = $payment;

                $this->audit->record($organization->getKey(), 'finance.payment_recorded', ($entry->isReceivable() ? 'Recebimento' : 'Pagamento').' de '.$this->money($payment->grossCents()).' ('.$method->name.', '.$account->name.')'.($pending ? ', aguardando liquidação' : '').": {$entry->description}.", [
                    'subject' => $payment, 'student_id' => $entry->student_id, 'enrollment_id' => $entry->enrollment_id,
                    'changes' => ['installment' => $current->number, 'applied_cents' => $applied, 'discount_cents' => $discount, 'interest_cents' => $interest, 'fine_cents' => $fine, 'fee_cents' => $fee],
                ]);
            }

            $this->refreshInstallment($current, $entry);

            return $created;
        });
    }

    /** Dinheiro de cartão/boleto efetivamente disponível: só então entra no caixa. */
    public function confirmPayment(Organization $organization, FinancePayment $payment, ?string $settledOn = null): FinancePayment
    {
        return DB::transaction(function () use ($organization, $payment, $settledOn) {
            $current = FinancePayment::query()->whereKey($payment->getKey())->lockForUpdate()->firstOrFail();

            if ($current->status !== 'pending') {
                throw new BusinessRuleException($current->status === 'confirmed' ? 'Este pagamento já foi confirmado.' : 'Este pagamento foi estornado.', 'payment_not_pending', 422);
            }

            $date = CarbonImmutable::parse($settledOn ?? $this->today($organization)->toDateString())->startOfDay();

            if ($date > $this->today($organization) || $date < CarbonImmutable::parse($current->paid_on->toDateString())) {
                throw new BusinessRuleException('A data da liquidação deve estar entre a data do pagamento e hoje.', 'settlement_date_invalid', 422);
            }

            $installment = FinanceInstallment::query()->whereKey($current->installment_id)->lockForUpdate()->firstOrFail();
            $entry = FinanceEntry::query()->findOrFail($installment->entry_id);

            $current->forceFill(['status' => 'confirmed', 'settled_on' => $date->toDateString(), 'confirmed_by' => auth()->id()])->save();
            $this->postMovements($current, $entry, $installment, $date);

            $this->audit->record($organization->getKey(), 'finance.payment_settled', 'Liquidação confirmada de '.$this->money($current->grossCents()).": {$entry->description}.", ['subject' => $current, 'student_id' => $entry->student_id]);

            return $current;
        });
    }

    /** Estorno: gera os movimentos opostos e reabre a parcela; o original permanece no extrato. */
    public function reversePayment(Organization $organization, FinancePayment $payment, string $reason): FinancePayment
    {
        return DB::transaction(function () use ($organization, $payment, $reason) {
            $current = FinancePayment::query()->whereKey($payment->getKey())->lockForUpdate()->firstOrFail();

            if ($current->status === 'reversed') {
                throw new BusinessRuleException('Este pagamento já foi estornado.', 'payment_already_reversed', 422);
            }

            $installment = FinanceInstallment::query()->whereKey($current->installment_id)->lockForUpdate()->firstOrFail();
            $entry = FinanceEntry::query()->findOrFail($installment->entry_id);
            $today = $this->today($organization);

            if ($current->status === 'confirmed') {
                foreach ($current->movements()->where('kind', '!=', 'reversal')->get() as $movement) {
                    $this->reverseMovement($movement, $today, "Estorno: {$entry->description}");
                }
            }

            $current->forceFill(['status' => 'reversed', 'reversed_at' => now(), 'reversed_by' => auth()->id(), 'reverse_reason' => $reason])->save();
            $this->refreshInstallment($installment, $entry);

            $this->audit->record($organization->getKey(), 'finance.payment_reversed', 'Pagamento estornado ('.$this->money($current->grossCents())."): {$entry->description}.", ['subject' => $current, 'reason' => $reason, 'student_id' => $entry->student_id]);

            return $current;
        });
    }

    // ----------------------------------------------------------------------------------- contas

    public function transfer(Organization $organization, array $data): FinanceTransfer
    {
        if ((int) $data['from_account_id'] === (int) $data['to_account_id']) {
            throw new BusinessRuleException('Escolha contas diferentes para transferir.', 'transfer_same_account', 422);
        }

        return DB::transaction(function () use ($organization, $data) {
            $from = FinanceAccount::query()->where('organization_id', $organization->getKey())->findOrFail($data['from_account_id']);
            $to = FinanceAccount::query()->where('organization_id', $organization->getKey())->findOrFail($data['to_account_id']);
            $date = CarbonImmutable::parse($data['occurred_on'])->startOfDay();

            if (! $from->active || ! $to->active) {
                throw new BusinessRuleException('Conta inativa. Escolha outra.', 'finance_inactive', 422);
            }

            if ($date > $this->today($organization)) {
                throw new BusinessRuleException('A data da transferência não pode ser futura.', 'transfer_in_future', 422);
            }

            foreach ([$from, $to] as $account) {
                if ($date < CarbonImmutable::parse($account->opening_date->toDateString())) {
                    throw new BusinessRuleException("A data é anterior ao saldo inicial da conta {$account->name}.", 'transfer_before_opening', 422);
                }
            }

            $transfer = FinanceTransfer::create([
                'organization_id' => $organization->getKey(), 'from_account_id' => $from->getKey(), 'to_account_id' => $to->getKey(),
                'amount_cents' => (int) $data['amount_cents'], 'occurred_on' => $date->toDateString(), 'reason' => $data['reason'], 'created_by' => auth()->id(),
            ]);

            $this->movement($organization, $from, 'out', $transfer->amount_cents, $date, 'transfer_out', "Transferência para {$to->name}: {$transfer->reason}", ['transfer_id' => $transfer->getKey()]);
            $this->movement($organization, $to, 'in', $transfer->amount_cents, $date, 'transfer_in', "Transferência de {$from->name}: {$transfer->reason}", ['transfer_id' => $transfer->getKey()]);

            $this->audit->record($organization->getKey(), 'finance.transfer', "Transferência de ".$this->money($transfer->amount_cents)." de {$from->name} para {$to->name}.", ['subject' => $transfer, 'reason' => $transfer->reason]);

            return $transfer;
        });
    }

    public function reverseTransfer(Organization $organization, FinanceTransfer $transfer, string $reason): FinanceTransfer
    {
        return DB::transaction(function () use ($organization, $transfer, $reason) {
            $current = FinanceTransfer::query()->whereKey($transfer->getKey())->lockForUpdate()->firstOrFail();

            if ($current->reversed_at !== null) {
                throw new BusinessRuleException('Esta transferência já foi estornada.', 'transfer_already_reversed', 422);
            }

            // As duas pontas voltam juntas: nunca uma sem a outra.
            foreach (FinanceMovement::query()->where('transfer_id', $current->getKey())->where('kind', '!=', 'reversal')->get() as $movement) {
                $this->reverseMovement($movement, $this->today($organization), 'Estorno de transferência');
            }

            $current->forceFill(['reversed_at' => now(), 'reversed_by' => auth()->id(), 'reverse_reason' => $reason])->save();
            $this->audit->record($organization->getKey(), 'finance.transfer_reversed', 'Transferência estornada ('.$this->money($current->amount_cents).').', ['subject' => $current, 'reason' => $reason]);

            return $current;
        });
    }

    /** Ajuste de saldo: sempre com motivo; o extrato anterior continua como estava. */
    public function adjust(Organization $organization, FinanceAccount $account, string $direction, int $amountCents, string $reason, ?string $date = null): FinanceMovement
    {
        return DB::transaction(function () use ($organization, $account, $direction, $amountCents, $reason, $date) {
            $on = CarbonImmutable::parse($date ?? $this->today($organization)->toDateString())->startOfDay();

            if ($on > $this->today($organization) || $on < CarbonImmutable::parse($account->opening_date->toDateString())) {
                throw new BusinessRuleException('A data do ajuste deve estar entre o saldo inicial da conta e hoje.', 'adjustment_date_invalid', 422);
            }

            $movement = $this->movement($organization, $account, $direction, $amountCents, $on, 'adjustment', "Ajuste de saldo: {$reason}");
            $this->audit->record($organization->getKey(), 'finance.adjustment', 'Ajuste de saldo em '.$account->name.': '.($direction === 'in' ? '+' : '−').$this->money($amountCents).'.', ['subject' => $account, 'reason' => $reason]);

            return $movement;
        });
    }

    /**
     * @param  list<int>  $movementIds  movimentos conferidos com o extrato externo
     */
    public function reconcile(Organization $organization, FinanceAccount $account, string $statementDate, int $statementBalanceCents, array $movementIds, ?string $notes): FinanceReconciliation
    {
        return DB::transaction(function () use ($organization, $account, $statementDate, $statementBalanceCents, $movementIds, $notes) {
            $system = $this->balance($account, $statementDate);

            FinanceMovement::query()->where('organization_id', $organization->getKey())->where('account_id', $account->getKey())
                ->whereIn('id', $movementIds)->where('occurred_on', '<=', $statementDate)->update(['reconciled_at' => now()]);

            $record = FinanceReconciliation::create([
                'organization_id' => $organization->getKey(), 'account_id' => $account->getKey(), 'statement_date' => $statementDate,
                'statement_balance_cents' => $statementBalanceCents, 'system_balance_cents' => $system, 'difference_cents' => $statementBalanceCents - $system,
                'notes' => $notes, 'created_by' => auth()->id(),
            ]);

            $this->audit->record($organization->getKey(), 'finance.reconciled', "Conferência de {$account->name} em ".CarbonImmutable::parse($statementDate)->format('d/m/Y').': '.($record->difference_cents === 0 ? 'sem divergência' : 'divergência de '.$this->money(abs($record->difference_cents))).'.', ['subject' => $account]);

            return $record;
        });
    }

    /** Saldo no fim do dia indicado: saldo inicial + entradas − saídas (transferências incluídas, pois mudam o saldo da conta). */
    public function balance(FinanceAccount $account, ?string $untilDate = null): int
    {
        $row = FinanceMovement::query()->where('account_id', $account->getKey())
            ->when($untilDate, fn ($q) => $q->where('occurred_on', '<=', $untilDate))
            ->selectRaw("COALESCE(SUM(CASE WHEN direction = 'in' THEN amount_cents ELSE -amount_cents END), 0) as net")->first();

        $opening = ($untilDate === null || $untilDate >= $account->opening_date->toDateString()) ? $account->opening_balance_cents : 0;

        return (int) $opening + (int) $row->net;
    }

    // ----------------------------------------------------------------------------------- internos

    private function postMovements(FinancePayment $payment, FinanceEntry $entry, FinanceInstallment $installment, CarbonImmutable $on): void
    {
        $organization = $payment->organization_id;
        $account = FinanceAccount::query()->findOrFail($payment->account_id);
        $label = ($entry->isReceivable() ? 'Recebimento' : 'Pagamento')." {$installment->number}/{$entry->installments_count}: {$entry->description}";
        $extra = ['payment_id' => $payment->getKey(), 'entry_id' => $entry->getKey(), 'category_id' => $entry->category_id];

        $this->movement(Organization::query()->findOrFail($organization), $account, $entry->isReceivable() ? 'in' : 'out', $payment->grossCents(), $on, $entry->isReceivable() ? 'payment_in' : 'payment_out', $label, $extra);

        if ($payment->fee_cents > 0) {
            $this->movement(Organization::query()->findOrFail($organization), $account, 'out', $payment->fee_cents, $on, 'payment_fee', "Taxa de pagamento: {$entry->description}", $extra);
        }
    }

    /** @param array<string, mixed> $extra */
    private function movement(Organization $organization, FinanceAccount $account, string $direction, int $amount, CarbonImmutable $on, string $kind, string $description, array $extra = []): FinanceMovement
    {
        return FinanceMovement::create([
            'organization_id' => $organization->getKey(), 'account_id' => $account->getKey(), 'direction' => $direction, 'amount_cents' => $amount,
            'occurred_on' => $on->toDateString(), 'kind' => $kind, 'description' => mb_substr($description, 0, 190), 'created_by' => auth()->id(),
        ] + $extra);
    }

    private function reverseMovement(FinanceMovement $movement, CarbonImmutable $on, string $description): void
    {
        // Idempotente: um movimento só é estornado uma vez.
        if (FinanceMovement::query()->where('reverses_movement_id', $movement->getKey())->exists()) {
            return;
        }

        FinanceMovement::create([
            'organization_id' => $movement->organization_id, 'account_id' => $movement->account_id, 'direction' => $movement->direction === 'in' ? 'out' : 'in',
            'amount_cents' => $movement->amount_cents, 'occurred_on' => $on->toDateString(), 'kind' => 'reversal', 'description' => mb_substr($description, 0, 190),
            'payment_id' => $movement->payment_id, 'transfer_id' => $movement->transfer_id, 'entry_id' => $movement->entry_id, 'category_id' => $movement->category_id,
            'reverses_movement_id' => $movement->getKey(), 'created_by' => auth()->id(),
        ]);
    }

    private function refreshInstallment(FinanceInstallment $installment, FinanceEntry $entry): void
    {
        $paid = (int) FinancePayment::query()->where('installment_id', $installment->getKey())->whereIn('status', ['pending', 'confirmed'])
            ->selectRaw('COALESCE(SUM(applied_cents + discount_cents), 0) as total')->value('total');

        $installment->forceFill([
            'paid_cents' => $paid,
            'status' => $installment->status === 'cancelled' ? 'cancelled' : ($paid >= $installment->amount_cents ? 'paid' : 'open'),
            'paid_on' => $paid >= $installment->amount_cents
                ? FinancePayment::query()->where('installment_id', $installment->getKey())->whereIn('status', ['pending', 'confirmed'])->max('paid_on')
                : null,
        ])->save();

        $this->syncFeeReimbursement($entry);
    }

    /** Taxa externa adiantada: quando a cobrança do reembolso é quitada (ou estornada), a situação do reembolso acompanha. */
    private function syncFeeReimbursement(FinanceEntry $entry): void
    {
        if ($entry->external_fee_id === null || ! str_ends_with((string) $entry->source_ref, ':reimbursement')) {
            return;
        }

        $open = $entry->installments()->where('status', 'open')->exists();
        ExternalFee::query()->whereKey($entry->external_fee_id)->where('reimbursement', $open ? 'settled' : 'to_settle')
            ->update(['reimbursement' => $open ? 'to_settle' : 'settled']);
    }

    private function refreshEntryTotal(FinanceEntry $entry): void
    {
        $entry->forceFill([
            'total_cents' => (int) $entry->installments()->where('status', '!=', 'cancelled')->sum('amount_cents') ?: $entry->total_cents,
        ])->save();
    }

    private function hasActivePayments(FinanceInstallment $installment): bool
    {
        return FinancePayment::query()->where('installment_id', $installment->getKey())->whereIn('status', ['pending', 'confirmed'])->exists();
    }

    private function category(Organization|int $organization, int $id, string $type): FinanceCategory
    {
        $organizationId = $organization instanceof Organization ? $organization->getKey() : $organization;
        $category = FinanceCategory::query()->where('organization_id', $organizationId)->whereKey($id)->first();

        if ($category === null || $category->type !== $type) {
            throw new BusinessRuleException('Escolha uma categoria de '.($type === 'income' ? 'receita' : 'despesa').'.', 'category_invalid', 422);
        }

        return $category;
    }

    private function money(int $cents): string
    {
        return 'R$ '.number_format($cents / 100, 2, ',', '.');
    }
}
