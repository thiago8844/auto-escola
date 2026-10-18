<?php

namespace App\Services\Finance;

use App\Models\FinanceAccount;
use App\Models\FinanceCategory;
use App\Models\FinanceEntry;
use App\Models\FinanceInstallment;
use App\Models\FinanceParty;
use App\Models\FinancePayment;
use App\Models\FinancePaymentMethod;
use App\Models\FinanceRecurrence;
use App\Models\FinanceTransfer;

/**
 * Formato JSON do financeiro (centavos sempre inteiros; datas no formato AAAA-MM-DD).
 */
class FinancePresenter
{
    public static function situation(FinanceInstallment $i, string $entryStatus, string $today): string
    {
        return match (true) {
            $i->status === 'cancelled' || $entryStatus === 'cancelled' => 'cancelled',
            $i->status === 'paid' => 'paid',
            $i->due_date->toDateString() < $today => 'overdue',
            $i->paid_cents > 0 => 'partial',
            default => 'forecast',
        };
    }

    /** @return array<string, mixed> */
    public static function account(FinanceAccount $a, ?int $balance = null): array
    {
        return [
            'id' => $a->getKey(), 'name' => $a->name, 'kind' => $a->kind, 'institution' => $a->institution, 'identification' => $a->identification,
            'opening_balance_cents' => $a->opening_balance_cents, 'opening_date' => $a->opening_date->toDateString(), 'active' => $a->active,
            'balance_cents' => $balance,
        ];
    }

    /** @return array<string, mixed> */
    public static function category(FinanceCategory $c): array
    {
        return ['id' => $c->getKey(), 'name' => $c->name, 'type' => $c->type, 'is_pass_through' => $c->is_pass_through, 'active' => $c->active];
    }

    /** @return array<string, mixed> */
    public static function method(FinancePaymentMethod $m): array
    {
        return ['id' => $m->getKey(), 'name' => $m->name, 'kind' => $m->kind, 'settlement_days' => $m->settlement_days, 'active' => $m->active];
    }

    /** @return array<string, mixed> */
    public static function party(FinanceParty $p): array
    {
        return ['id' => $p->getKey(), 'name' => $p->name, 'document' => $p->document, 'email' => $p->email, 'phone' => $p->phone, 'notes' => $p->notes, 'active' => $p->active];
    }

    /** @return array<string, mixed> */
    public static function recurrence(FinanceRecurrence $r): array
    {
        return [
            'id' => $r->getKey(), 'type' => $r->type, 'description' => $r->description, 'category_id' => $r->category_id, 'student_id' => $r->student_id,
            'partner_id' => $r->partner_id, 'party_id' => $r->party_id, 'amount_cents' => $r->amount_cents, 'day_of_month' => $r->day_of_month,
            'starts_on' => $r->starts_on->toDateString(), 'ends_on' => $r->ends_on?->toDateString(), 'active' => $r->active,
        ];
    }

    /** @return array<string, mixed> */
    public static function payment(FinancePayment $p): array
    {
        return [
            'id' => $p->getKey(), 'installment_id' => $p->installment_id, 'status' => $p->status, 'paid_on' => $p->paid_on->toDateString(),
            'expected_on' => $p->expected_on?->toDateString(), 'settled_on' => $p->settled_on?->toDateString(),
            'applied_cents' => $p->applied_cents, 'discount_cents' => $p->discount_cents, 'interest_cents' => $p->interest_cents, 'fine_cents' => $p->fine_cents, 'fee_cents' => $p->fee_cents,
            'gross_cents' => $p->grossCents(), 'net_cents' => $p->grossCents() - $p->fee_cents, 'adjust_reason' => $p->adjust_reason,
            'reference' => $p->reference, 'notes' => $p->notes,
            'account' => $p->relationLoaded('account') && $p->account ? ['id' => $p->account->getKey(), 'name' => $p->account->name] : ['id' => $p->account_id],
            'method' => $p->relationLoaded('method') && $p->method ? ['id' => $p->method->getKey(), 'name' => $p->method->name, 'kind' => $p->method->kind] : ['id' => $p->method_id],
            'created_by' => $p->relationLoaded('creator') && $p->creator ? ['id' => $p->creator->getKey(), 'name' => $p->creator->name] : null,
            'reversed_at' => $p->reversed_at?->toIso8601String(), 'reverse_reason' => $p->reverse_reason,
            'receipt_number' => self::receiptNumber($p),
        ];
    }

    public static function receiptNumber(FinancePayment $p): string
    {
        return 'RC-'.$p->paid_on->format('Y').'-'.str_pad((string) $p->getKey(), 6, '0', STR_PAD_LEFT);
    }

    /** @return array<string, mixed> */
    public static function installment(FinanceInstallment $i, string $today, bool $withPayments = false): array
    {
        $entry = $i->relationLoaded('entry') ? $i->entry : null;

        return [
            'id' => $i->getKey(), 'entry_id' => $i->entry_id, 'number' => $i->number, 'due_date' => $i->due_date->toDateString(),
            'amount_cents' => $i->amount_cents, 'paid_cents' => $i->paid_cents, 'outstanding_cents' => $i->outstandingCents(),
            'status' => $i->status, 'paid_on' => $i->paid_on?->toDateString(),
            'situation' => $entry ? self::situation($i, $entry->status, $today) : ($i->status === 'cancelled' ? 'cancelled' : null),
            'entry' => $entry ? self::entrySummary($entry) : null,
            'payments' => $withPayments ? $i->payments->map(fn ($p) => self::payment($p))->all() : null,
        ];
    }

    /** @return array<string, mixed> */
    public static function entrySummary(FinanceEntry $e): array
    {
        return [
            'id' => $e->getKey(), 'type' => $e->type, 'description' => $e->description, 'status' => $e->status, 'installments_count' => $e->installments_count,
            'total_cents' => $e->total_cents, 'issued_on' => $e->issued_on->toDateString(),
            'category' => $e->relationLoaded('category') && $e->category ? ['id' => $e->category->getKey(), 'name' => $e->category->name, 'is_pass_through' => $e->category->is_pass_through] : ['id' => $e->category_id],
            'student' => $e->relationLoaded('student') && $e->student ? ['id' => $e->student->getKey(), 'name' => $e->student->name] : null,
            'partner' => $e->relationLoaded('partner') && $e->partner ? ['id' => $e->partner->getKey(), 'name' => $e->partner->name] : null,
            'party' => $e->relationLoaded('party') && $e->party ? ['id' => $e->party->getKey(), 'name' => $e->party->name] : null,
            'enrollment_id' => $e->enrollment_id, 'vehicle_id' => $e->vehicle_id, 'maintenance_id' => $e->maintenance_id, 'external_fee_id' => $e->external_fee_id,
            'source_ref' => $e->source_ref,
        ];
    }

    /** @return array<string, mixed> */
    public static function entry(FinanceEntry $e, string $today): array
    {
        return self::entrySummary($e) + [
            'notes' => $e->notes, 'recurrence_id' => $e->recurrence_id,
            'cancelled_at' => $e->cancelled_at?->toIso8601String(), 'cancel_reason' => $e->cancel_reason,
            'created_by' => $e->relationLoaded('creator') && $e->creator ? ['id' => $e->creator->getKey(), 'name' => $e->creator->name] : null,
            'installments' => $e->installments->map(fn ($i) => self::installment($i->setRelation('entry', $e), $today, true))->all(),
            'paid_cents' => (int) $e->installments->where('status', '!=', 'cancelled')->sum('paid_cents'),
            'outstanding_cents' => (int) $e->installments->sum(fn ($i) => $i->outstandingCents()),
        ];
    }

    /** @return array<string, mixed> */
    public static function transfer(FinanceTransfer $t): array
    {
        return [
            'id' => $t->getKey(), 'from_account' => ['id' => $t->from_account_id, 'name' => $t->relationLoaded('fromAccount') ? $t->fromAccount?->name : null],
            'to_account' => ['id' => $t->to_account_id, 'name' => $t->relationLoaded('toAccount') ? $t->toAccount?->name : null],
            'amount_cents' => $t->amount_cents, 'occurred_on' => $t->occurred_on->toDateString(), 'reason' => $t->reason,
            'reversed_at' => $t->reversed_at?->toIso8601String(), 'reverse_reason' => $t->reverse_reason,
        ];
    }
}
