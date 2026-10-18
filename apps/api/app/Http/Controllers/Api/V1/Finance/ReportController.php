<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Enums\FeeParty;
use App\Models\ExternalFee;
use App\Models\FinanceAccount;
use App\Models\FinanceEntry;
use App\Models\FinanceInstallment;
use App\Models\FinanceMovement;
use App\Models\FinanceTransfer;
use App\Models\Organization;
use App\Models\Partner;
use App\Services\Audit;
use App\Services\Finance\FinancePresenter;
use App\Services\Finance\FinanceQuery;
use App\Services\Finance\FinanceReports;
use App\Services\Finance\FinanceService;
use App\Services\Reports\Csv;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Painel, fluxo de caixa, extratos, transferências, quebras e exportação do financeiro.
 */
class ReportController extends FinanceController
{
    /** @return array{0: string, 1: string} período no fuso do espaço (padrão: do início do mês até hoje) */
    private function period(Request $request, Organization $organization, FinanceService $service): array
    {
        $data = $request->validate(['from' => ['nullable', 'date'], 'to' => ['nullable', 'date', 'after_or_equal:from']]);
        $today = $service->today($organization);

        return [$data['from'] ?? $today->startOfMonth()->toDateString(), $data['to'] ?? $today->toDateString()];
    }

    public function overview(Request $request, Organization $organization, FinanceService $service, FinanceReports $reports): JsonResponse
    {
        $this->operate($request, $organization);
        [$from, $to] = $this->period($request, $organization, $service);

        return response()->json(['data' => $reports->overview($organization, $from, $to)]);
    }

    public function cashFlow(Request $request, Organization $organization, FinanceService $service, FinanceReports $reports): JsonResponse
    {
        $this->operate($request, $organization);
        [$from, $to] = $this->period($request, $organization, $service);
        $by = $request->validate(['by' => ['nullable', Rule::in(['day', 'month'])]])['by'] ?? 'day';

        return response()->json(['data' => ['period' => ['from' => $from, 'to' => $to]] + $reports->cashFlow($organization, $from, $to, $by)]);
    }

    public function breakdown(Request $request, Organization $organization, FinanceService $service, FinanceReports $reports): JsonResponse
    {
        $this->operate($request, $organization);
        [$from, $to] = $this->period($request, $organization, $service);
        $by = $request->validate(['by' => ['required', Rule::in(['category', 'student', 'partner', 'method', 'account'])]])['by'];

        return response()->json(['data' => ['period' => ['from' => $from, 'to' => $to], 'by' => $by, 'rows' => $reports->breakdown($organization, $from, $to, $by)]]);
    }

    public function statement(Request $request, Organization $organization, FinanceAccount $financeAccount, FinanceService $service, FinanceReports $reports): JsonResponse
    {
        $this->operate($request, $organization);
        [$from, $to] = $this->period($request, $organization, $service);

        return response()->json(['data' => $reports->statement($organization, $financeAccount, $from, $to)]);
    }

    /**
     * Consolidado de todas as contas: saldo inicial + entradas reais − saídas reais = saldo final. Transferências entre
     * contas se anulam e ficam de fora das entradas e saídas (não são faturamento nem despesa).
     */
    public function consolidated(Request $request, Organization $organization, FinanceService $service, FinanceReports $reports): JsonResponse
    {
        $this->operate($request, $organization);
        [$from, $to] = $this->period($request, $organization, $service);

        $accounts = $organization->financeAccounts()->get();
        $statements = $accounts->map(fn ($a) => $reports->statement($organization, $a, $from, $to));
        $transfersIn = (int) $statements->sum(fn ($s) => $s['breakdown']['transfers_in_cents']);
        $transfersOut = (int) $statements->sum(fn ($s) => $s['breakdown']['transfers_out_cents']);

        return response()->json(['data' => [
            'period' => ['from' => $from, 'to' => $to],
            'opening_balance_cents' => (int) $statements->sum('opening_balance_cents'),
            'total_in_cents' => (int) $statements->sum('total_in_cents') - $transfersIn,
            'total_out_cents' => (int) $statements->sum('total_out_cents') - $transfersOut,
            'transfers_cents' => $transfersIn,
            'closing_balance_cents' => (int) $statements->sum('closing_balance_cents'),
            'realized' => $reports->realized($organization, $from, $to),
            'accounts' => $statements->map(fn ($s) => ['account' => $s['account'], 'opening_balance_cents' => $s['opening_balance_cents'], 'total_in_cents' => $s['total_in_cents'], 'total_out_cents' => $s['total_out_cents'], 'closing_balance_cents' => $s['closing_balance_cents']])->all(),
        ]]);
    }

    public function movements(Request $request, Organization $organization): JsonResponse
    {
        $this->operate($request, $organization);
        $data = $request->validate(['account_id' => ['nullable', 'integer'], 'kind' => ['nullable', 'string', 'max:16'], 'from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);

        $page = FinanceMovement::query()->where('organization_id', $organization->getKey())->with('account:id,name')
            ->when($data['account_id'] ?? null, fn ($q, $v) => $q->where('account_id', $v))->when($data['kind'] ?? null, fn ($q, $v) => $q->where('kind', $v))
            ->when($data['from'] ?? null, fn ($q, $v) => $q->whereDate('occurred_on', '>=', $v))->when($data['to'] ?? null, fn ($q, $v) => $q->whereDate('occurred_on', '<=', $v))
            ->orderByDesc('occurred_on')->orderByDesc('id')->paginate($this->perPage($request));

        return response()->json([
            'data' => collect($page->items())->map(fn (FinanceMovement $m) => [
                'id' => $m->getKey(), 'date' => $m->occurred_on->toDateString(), 'account' => ['id' => $m->account_id, 'name' => $m->account?->name], 'kind' => $m->kind,
                'direction' => $m->direction, 'amount_cents' => $m->amount_cents, 'description' => $m->description, 'entry_id' => $m->entry_id, 'payment_id' => $m->payment_id,
                'reconciled' => $m->reconciled_at !== null,
            ])->all(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    // ------------------------------------------------------------------------ transferências

    public function transfers(Request $request, Organization $organization): JsonResponse
    {
        $this->operate($request, $organization);

        $page = FinanceTransfer::query()->where('organization_id', $organization->getKey())->with(['fromAccount:id,name', 'toAccount:id,name'])->orderByDesc('occurred_on')->orderByDesc('id')->paginate($this->perPage($request));

        return response()->json([
            'data' => collect($page->items())->map(fn ($t) => FinancePresenter::transfer($t))->all(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
        ]);
    }

    public function transfer(Request $request, Organization $organization, FinanceService $service): JsonResponse
    {
        $this->manage($request, $organization);
        $id = $organization->getKey();

        $data = $request->validate([
            'from_account_id' => ['required', 'integer', Rule::exists('finance_accounts', 'id')->where('organization_id', $id)],
            'to_account_id' => ['required', 'integer', Rule::exists('finance_accounts', 'id')->where('organization_id', $id)],
            'amount_cents' => ['required', 'integer', 'min:1', 'max:100000000000'], 'occurred_on' => ['required', 'date'], 'reason' => ['required', 'string', 'min:3', 'max:255'],
        ]);

        return response()->json(['data' => FinancePresenter::transfer($service->transfer($organization, $data)->load(['fromAccount', 'toAccount']))], 201);
    }

    public function reverseTransfer(Request $request, Organization $organization, FinanceTransfer $financeTransfer, FinanceService $service): JsonResponse
    {
        $this->manage($request, $organization);
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);

        return response()->json(['data' => FinancePresenter::transfer($service->reverseTransfer($organization, $financeTransfer, $data['reason'])->load(['fromAccount', 'toAccount']))]);
    }

    // ------------------------------------------------------------------------ parceiros e taxas

    /** Recebíveis e repasses por parceiro, sem compartilhar dados entre organizações. */
    public function partner(Request $request, Organization $organization, Partner $partner): JsonResponse
    {
        $this->operate($request, $organization);

        $sum = fn (string $type) => FinanceInstallment::query()->join('finance_entries', 'finance_entries.id', '=', 'finance_installments.entry_id')
            ->where('finance_installments.organization_id', $organization->getKey())->where('finance_entries.partner_id', $partner->getKey())->where('finance_entries.type', $type)
            ->where('finance_entries.status', 'active')->where('finance_installments.status', '!=', 'cancelled')
            ->selectRaw('COALESCE(SUM(finance_installments.amount_cents),0) as total, COALESCE(SUM(finance_installments.paid_cents),0) as paid')->first();

        $receivable = $sum('receivable');
        $payable = $sum('payable');

        return response()->json(['data' => [
            'partner' => ['id' => $partner->getKey(), 'name' => $partner->name],
            'receivable' => ['total_cents' => (int) $receivable->total, 'received_cents' => (int) $receivable->paid, 'outstanding_cents' => (int) $receivable->total - (int) $receivable->paid],
            'payable' => ['total_cents' => (int) $payable->total, 'paid_cents' => (int) $payable->paid, 'outstanding_cents' => (int) $payable->total - (int) $payable->paid],
            'basis' => 'Recebíveis: cobranças em que o parceiro é o pagador. Repasses: despesas em que o parceiro é o favorecido.',
        ]]);
    }

    /** Taxas externas adiantadas pelo espaço: quem adiantou, valor a acertar e a baixa. */
    public function feeAdvances(Request $request, Organization $organization): JsonResponse
    {
        $this->operate($request, $organization);

        $fees = ExternalFee::query()->where('organization_id', $organization->getKey())
            ->where(fn ($q) => $q->where('paid_by', FeeParty::Organization->value)->orWhere('reimbursement', '!=', 'none'))
            ->with('student:id,name')->orderByDesc('id')->limit(200)->get();
        $entries = FinanceEntry::query()->where('organization_id', $organization->getKey())->whereIn('external_fee_id', $fees->pluck('id'))->with('installments')->get()->groupBy('external_fee_id');

        return response()->json(['data' => $fees->map(function (ExternalFee $fee) use ($entries) {
            $mine = $entries->get($fee->getKey(), collect());
            $reimbursement = $mine->first(fn ($e) => str_ends_with((string) $e->source_ref, ':reimbursement'));
            $advance = $mine->first(fn ($e) => str_ends_with((string) $e->source_ref, ':advance'));

            return [
                'fee_id' => $fee->getKey(), 'kind' => $fee->kind, 'student' => $fee->student?->name, 'amount_cents' => $fee->amount_cents,
                'obligor' => $fee->obligor->value, 'paid_by' => $fee->paid_by?->value, 'reimbursement' => $fee->reimbursement, 'status' => $fee->status->value,
                'reimbursement_entry_id' => $reimbursement?->getKey(), 'advance_entry_id' => $advance?->getKey(),
                'to_settle_cents' => $reimbursement ? (int) $reimbursement->installments->sum(fn ($i) => $i->outstandingCents()) : ($fee->reimbursement === 'to_settle' ? (int) $fee->amount_cents : 0),
            ];
        })->all()]);
    }

    // ------------------------------------------------------------------------ exportação

    public function exportInstallments(Request $request, Organization $organization, FinanceQuery $query, FinanceService $service, Audit $audit): StreamedResponse
    {
        $this->operate($request, $organization);
        $filters = $request->validate(EntryController::filterRules());
        $today = $service->today($organization)->toDateString();
        $audit->record($organization->getKey(), 'report.exported', 'Exportação CSV do financeiro (parcelas).', ['changes' => $filters]);
        $labels = ['forecast' => 'Prevista', 'overdue' => 'Vencida', 'partial' => 'Parcialmente paga', 'paid' => 'Paga', 'cancelled' => 'Cancelada'];
        $money = fn (int $c) => number_format($c / 100, 2, ',', '');

        $rows = (function () use ($query, $organization, $filters, $today, $labels, $money) {
            foreach ($query->installments($organization, $filters)->with(EntryController::RELATIONS)->orderBy('finance_installments.due_date')->orderBy('finance_installments.id')->cursor() as $i) {
                $e = $i->entry;
                yield [
                    $e->type === 'receivable' ? 'Receita' : 'Despesa', $e->description, ($e->partner ?? $e->student ?? $e->party)?->name, $e->category?->name,
                    "{$i->number}/{$e->installments_count}", $i->due_date->format('d/m/Y'), $money($i->amount_cents), $money($i->paid_cents), $money($i->outstandingCents()),
                    $labels[FinancePresenter::situation($i, $e->status, $today)], $i->paid_on?->format('d/m/Y'),
                ];
            }
        })();

        return Csv::download('financeiro-parcelas-'.now()->format('Ymd-His').'.csv',
            ['Tipo', 'Descrição', 'Pessoa', 'Categoria', 'Parcela', 'Vencimento', 'Valor (R$)', 'Pago (R$)', 'Em aberto (R$)', 'Situação', 'Quitada em'], $rows);
    }

    public function exportMovements(Request $request, Organization $organization, FinanceService $service, Audit $audit): StreamedResponse
    {
        $this->operate($request, $organization);
        $data = $request->validate(['account_id' => ['nullable', 'integer'], 'from' => ['nullable', 'date'], 'to' => ['nullable', 'date']]);
        $audit->record($organization->getKey(), 'report.exported', 'Exportação CSV do financeiro (movimentações).', ['changes' => $data]);
        $kinds = ['payment_in' => 'Recebimento', 'payment_out' => 'Pagamento', 'payment_fee' => 'Taxa de pagamento', 'transfer_in' => 'Transferência (entrada)', 'transfer_out' => 'Transferência (saída)', 'adjustment' => 'Ajuste de saldo', 'reversal' => 'Estorno'];
        $money = fn (int $c) => number_format($c / 100, 2, ',', '');

        $rows = (function () use ($organization, $data, $kinds, $money) {
            $query = FinanceMovement::query()->where('organization_id', $organization->getKey())->with('account:id,name')
                ->when($data['account_id'] ?? null, fn ($q, $v) => $q->where('account_id', $v))
                ->when($data['from'] ?? null, fn ($q, $v) => $q->whereDate('occurred_on', '>=', $v))->when($data['to'] ?? null, fn ($q, $v) => $q->whereDate('occurred_on', '<=', $v))
                ->orderBy('occurred_on')->orderBy('id');

            foreach ($query->cursor() as $m) {
                yield [$m->occurred_on->format('d/m/Y'), $m->account?->name, $kinds[$m->kind] ?? $m->kind, $m->direction === 'in' ? 'Entrada' : 'Saída', $money($m->amount_cents), $m->description, $m->reconciled_at ? 'Sim' : 'Não'];
            }
        })();

        return Csv::download('financeiro-movimentacoes-'.now()->format('Ymd-His').'.csv', ['Data', 'Conta', 'Tipo', 'Sentido', 'Valor (R$)', 'Descrição', 'Conferido'], $rows);
    }
}
