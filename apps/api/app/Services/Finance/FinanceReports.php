<?php

namespace App\Services\Finance;

use App\Models\FinanceAccount;
use App\Models\FinanceMovement;
use App\Models\FinancePayment;
use App\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Painel, fluxo de caixa, extratos e quebras do financeiro.
 *
 * - Realizado = movimentos de caixa na DATA em que o dinheiro entrou/saiu (`occurred_on`). Previsto = parcelas em
 *   aberto pelo VENCIMENTO. Parcelas em aberto nunca alteram o realizado.
 * - Transferência muda o saldo de cada conta, mas some no consolidado e nunca é receita nem despesa.
 * - Faturamento = recebimentos líquidos de estorno, fora de categorias de repasse/reembolso.
 */
class FinanceReports
{
    public function __construct(private readonly FinanceService $service, private readonly FinanceQuery $query) {}

    /** @return array<string, mixed> */
    public function overview(Organization $org, string $from, string $to): array
    {
        $today = $this->service->today($org)->toDateString();
        $installments = fn (string $type) => DB::table('finance_installments')->join('finance_entries', 'finance_entries.id', '=', 'finance_installments.entry_id')
            ->where('finance_installments.organization_id', $org->getKey())->where('finance_entries.type', $type)->where('finance_entries.status', 'active')->where('finance_installments.status', 'open');
        $outstanding = 'COALESCE(SUM(finance_installments.amount_cents - finance_installments.paid_cents),0)';

        $side = fn (string $type) => [
            'outstanding_cents' => (int) $installments($type)->selectRaw("{$outstanding} as v")->value('v'),
            'overdue' => [
                'count' => $installments($type)->where('finance_installments.due_date', '<', $today)->count(),
                'cents' => (int) $installments($type)->where('finance_installments.due_date', '<', $today)->selectRaw("{$outstanding} as v")->value('v'),
            ],
            'next_30_days_cents' => (int) $installments($type)->where('finance_installments.due_date', '>=', $today)->where('finance_installments.due_date', '<=', CarbonImmutable::parse($today)->addDays(30)->toDateString())->selectRaw("{$outstanding} as v")->value('v'),
        ];

        $accounts = FinanceAccount::query()->where('organization_id', $org->getKey())->orderBy('name')->get()
            ->map(fn (FinanceAccount $a) => ['id' => $a->getKey(), 'name' => $a->name, 'kind' => $a->kind, 'active' => $a->active, 'balance_cents' => $this->service->balance($a)])
            ->filter(fn ($a) => $a['active'] || $a['balance_cents'] !== 0)->values();

        $pending = fn (string $type) => (int) FinancePayment::query()->join('finance_installments', 'finance_installments.id', '=', 'finance_payments.installment_id')
            ->join('finance_entries', 'finance_entries.id', '=', 'finance_installments.entry_id')
            ->where('finance_payments.organization_id', $org->getKey())->where('finance_payments.status', 'pending')->where('finance_entries.type', $type)
            ->selectRaw('COALESCE(SUM(finance_payments.applied_cents + finance_payments.interest_cents + finance_payments.fine_cents - finance_payments.fee_cents),0) as v')->value('v');

        return [
            'period' => ['from' => $from, 'to' => $to],
            'receivable' => $side('receivable'),
            'payable' => $side('payable'),
            'realized' => $this->realized($org, $from, $to),
            'accounts' => $accounts->all(),
            'consolidated_balance_cents' => (int) $accounts->sum('balance_cents'),
            'awaiting_settlement' => ['in_cents' => $pending('receivable'), 'out_cents' => $pending('payable')],
            'basis' => 'Realizado usa a data em que o dinheiro entrou ou saiu; previsto usa o vencimento. Transferências e saldo inicial não são receita nem despesa.',
        ];
    }

    /**
     * Totais realizados no período, opcionalmente de uma conta. Estornos descontam do tipo original.
     *
     * @return array<string, int>
     */
    public function realized(Organization $org, string $from, string $to, ?int $accountId = null): array
    {
        $rows = DB::table('finance_movements as m')
            ->leftJoin('finance_movements as o', 'o.id', '=', 'm.reverses_movement_id')
            ->leftJoin('finance_categories as c', 'c.id', '=', 'm.category_id')
            ->where('m.organization_id', $org->getKey())->whereBetween('m.occurred_on', [$from, $to])
            ->when($accountId, fn ($q, $v) => $q->where('m.account_id', $v))
            ->selectRaw("CASE WHEN m.kind = 'reversal' THEN o.kind ELSE m.kind END as effective_kind,
                COALESCE(c.is_pass_through, 0) as pass,
                SUM(CASE WHEN m.direction = 'in' THEN m.amount_cents ELSE -m.amount_cents END) as signed")
            ->groupBy('effective_kind', 'pass')->get();

        $sum = fn (string $kind, ?int $pass = null) => (int) $rows->filter(fn ($r) => $r->effective_kind === $kind && ($pass === null || (int) $r->pass === $pass))->sum('signed');

        return [
            'receipts_cents' => $sum('payment_in', 0),                  // faturamento (sem repasses)
            'pass_through_in_cents' => $sum('payment_in', 1),           // reembolsos e repasses recebidos
            'payments_cents' => -$sum('payment_out', 0),
            'pass_through_out_cents' => -$sum('payment_out', 1),
            'fees_cents' => -$sum('payment_fee'),
            'adjustments_cents' => $sum('adjustment'),                  // + entrada, − saída
            'transfers_in_cents' => $sum('transfer_in'),
            'transfers_out_cents' => -$sum('transfer_out'),
        ];
    }

    /** @return array<string, mixed> */
    public function cashFlow(Organization $org, string $from, string $to, string $by = 'day'): array
    {
        $format = $by === 'month' ? '%Y-%m' : '%Y-%m-%d';
        $realized = DB::table('finance_movements as m')
            ->leftJoin('finance_movements as o', 'o.id', '=', 'm.reverses_movement_id')
            ->where('m.organization_id', $org->getKey())->whereBetween('m.occurred_on', [$from, $to])
            ->whereRaw("(CASE WHEN m.kind = 'reversal' THEN o.kind ELSE m.kind END) IN ('payment_in','payment_out','payment_fee')")
            ->selectRaw("DATE_FORMAT(m.occurred_on, '{$format}') as bucket,
                SUM(CASE WHEN m.direction = 'in' THEN m.amount_cents ELSE 0 END) as inflow,
                SUM(CASE WHEN m.direction = 'out' THEN m.amount_cents ELSE 0 END) as outflow")
            ->groupBy('bucket')->get()->keyBy('bucket');

        $forecast = DB::table('finance_installments')->join('finance_entries', 'finance_entries.id', '=', 'finance_installments.entry_id')
            ->where('finance_installments.organization_id', $org->getKey())->where('finance_installments.status', 'open')->where('finance_entries.status', 'active')
            ->whereBetween('finance_installments.due_date', [$from, $to])
            ->selectRaw("DATE_FORMAT(finance_installments.due_date, '{$format}') as bucket, finance_entries.type as type, SUM(finance_installments.amount_cents - finance_installments.paid_cents) as v")
            ->groupBy('bucket', 'type')->get();

        $buckets = collect($realized->keys())->merge($forecast->pluck('bucket'))->unique()->sort()->values();

        return [
            'by' => $by,
            'rows' => $buckets->map(fn ($b) => [
                'bucket' => $b,
                'realized_in_cents' => (int) ($realized[$b]->inflow ?? 0),
                'realized_out_cents' => (int) ($realized[$b]->outflow ?? 0),
                'forecast_in_cents' => (int) $forecast->where('bucket', $b)->where('type', 'receivable')->sum('v'),
                'forecast_out_cents' => (int) $forecast->where('bucket', $b)->where('type', 'payable')->sum('v'),
            ])->all(),
        ];
    }

    /**
     * Extrato da conta: saldo de abertura, entradas, saídas, transferências, ajustes e saldo final.
     *
     * @return array<string, mixed>
     */
    public function statement(Organization $org, FinanceAccount $account, string $from, string $to): array
    {
        $opening = $from <= $account->opening_date->toDateString()
            ? $account->opening_balance_cents
            : $this->service->balance($account, CarbonImmutable::parse($from)->subDay()->toDateString());

        $movements = FinanceMovement::query()->where('account_id', $account->getKey())->whereBetween('occurred_on', [$from, $to])
            ->orderBy('occurred_on')->orderBy('id')->get();

        $running = $opening;
        $lines = $movements->map(function (FinanceMovement $m) use (&$running) {
            $running += $m->direction === 'in' ? $m->amount_cents : -$m->amount_cents;

            return [
                'id' => $m->getKey(), 'date' => $m->occurred_on->toDateString(), 'kind' => $m->kind, 'direction' => $m->direction,
                'amount_cents' => $m->amount_cents, 'description' => $m->description, 'payment_id' => $m->payment_id, 'transfer_id' => $m->transfer_id,
                'entry_id' => $m->entry_id, 'reconciled' => $m->reconciled_at !== null, 'balance_cents' => $running,
            ];
        });

        $in = (int) $movements->where('direction', 'in')->sum('amount_cents');
        $out = (int) $movements->where('direction', 'out')->sum('amount_cents');
        $kind = fn (string $k, string $d) => (int) $movements->where('kind', $k)->where('direction', $d)->sum('amount_cents');

        return [
            'account' => ['id' => $account->getKey(), 'name' => $account->name, 'kind' => $account->kind, 'active' => $account->active],
            'period' => ['from' => $from, 'to' => $to],
            'opening_balance_cents' => $opening,
            'total_in_cents' => $in,
            'total_out_cents' => $out,
            'closing_balance_cents' => $opening + $in - $out,
            'breakdown' => [
                'receipts_cents' => $kind('payment_in', 'in'), 'payments_cents' => $kind('payment_out', 'out'), 'fees_cents' => $kind('payment_fee', 'out'),
                'transfers_in_cents' => $kind('transfer_in', 'in'), 'transfers_out_cents' => $kind('transfer_out', 'out'),
                'adjustments_in_cents' => $kind('adjustment', 'in'), 'adjustments_out_cents' => $kind('adjustment', 'out'),
                'reversals_in_cents' => $kind('reversal', 'in'), 'reversals_out_cents' => $kind('reversal', 'out'),
            ],
            'lines' => $lines->all(),
            'current_balance_cents' => $this->service->balance($account),
        ];
    }

    /**
     * Quebra do realizado por categoria, aluno, parceiro, forma de pagamento ou conta.
     *
     * @return list<array<string, mixed>>
     */
    public function breakdown(Organization $org, string $from, string $to, string $by): array
    {
        $join = match ($by) {
            'category' => ['finance_categories as g', 'g.id', '=', 'm.category_id', 'g.name'],
            'student' => ['students as g', 'g.id', '=', 'e.student_id', 'g.name'],
            'partner' => ['partners as g', 'g.id', '=', 'e.partner_id', 'g.name'],
            'account' => ['finance_accounts as g', 'g.id', '=', 'm.account_id', 'g.name'],
            'method' => ['finance_payment_methods as g', 'g.id', '=', 'p.method_id', 'g.name'],
        };

        return DB::table('finance_movements as m')
            ->leftJoin('finance_movements as o', 'o.id', '=', 'm.reverses_movement_id')
            ->leftJoin('finance_entries as e', 'e.id', '=', 'm.entry_id')
            ->leftJoin('finance_payments as p', 'p.id', '=', 'm.payment_id')
            ->leftJoin($join[0], $join[1], $join[2], $join[3])
            ->where('m.organization_id', $org->getKey())->whereBetween('m.occurred_on', [$from, $to])
            ->whereRaw("(CASE WHEN m.kind = 'reversal' THEN o.kind ELSE m.kind END) IN ('payment_in','payment_out')")
            ->selectRaw("g.id as id, COALESCE({$join[4]}, 'Sem identificação') as label,
                COALESCE(SUM(CASE WHEN (CASE WHEN m.kind = 'reversal' THEN o.kind ELSE m.kind END) = 'payment_in' THEN (CASE WHEN m.direction = 'in' THEN m.amount_cents ELSE -m.amount_cents END) ELSE 0 END),0) as received,
                COALESCE(SUM(CASE WHEN (CASE WHEN m.kind = 'reversal' THEN o.kind ELSE m.kind END) = 'payment_out' THEN (CASE WHEN m.direction = 'out' THEN m.amount_cents ELSE -m.amount_cents END) ELSE 0 END),0) as paid")
            ->groupBy('g.id', 'label')->orderByDesc('received')->get()
            ->map(fn ($r) => ['id' => $r->id, 'label' => $r->label, 'received_cents' => (int) $r->received, 'paid_cents' => (int) $r->paid])->all();
    }
}
