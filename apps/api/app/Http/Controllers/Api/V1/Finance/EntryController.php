<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Exceptions\BusinessRuleException;
use App\Models\FinanceEntry;
use App\Models\FinanceInstallment;
use App\Models\FinancePayment;
use App\Models\Organization;
use App\Services\Finance\FinancePresenter;
use App\Services\Finance\FinanceQuery;
use App\Services\Finance\FinanceService;
use App\Services\Finance\InstallmentPlanner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Lançamentos (receitas e despesas), parcelas e baixas.
 */
class EntryController extends FinanceController
{
    public const RELATIONS = ['entry.category', 'entry.student', 'entry.partner', 'entry.party'];

    /** @return array<string, mixed> */
    public static function filterRules(): array
    {
        return [
            'type' => ['nullable', Rule::in(['receivable', 'payable'])], 'situation' => ['nullable', 'string', 'max:80'],
            'from' => ['nullable', 'date'], 'to' => ['nullable', 'date'], 'date_field' => ['nullable', Rule::in(['due', 'paid'])],
            'student_id' => ['nullable', 'integer'], 'partner_id' => ['nullable', 'integer'], 'party_id' => ['nullable', 'integer'],
            'category_id' => ['nullable', 'integer'], 'method_id' => ['nullable', 'integer'], 'account_id' => ['nullable', 'integer'],
            'enrollment_id' => ['nullable', 'integer'], 'vehicle_id' => ['nullable', 'integer'], 'entry_id' => ['nullable', 'integer'], 'q' => ['nullable', 'string', 'max:100'],
        ];
    }

    public function installments(Request $request, Organization $organization, FinanceQuery $query, FinanceService $service): JsonResponse
    {
        $this->operate($request, $organization);
        $filters = $request->validate(self::filterRules());
        $today = $service->today($organization)->toDateString();

        $page = $query->installments($organization, $filters)->with(self::RELATIONS)
            ->orderBy('finance_installments.due_date')->orderBy('finance_installments.id')->paginate($this->perPage($request));

        return response()->json([
            'data' => collect($page->items())->map(fn (FinanceInstallment $i) => FinancePresenter::installment($i, $today))->all(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'per_page' => $page->perPage(), 'total' => $page->total()],
            'totals' => $query->totals($organization, $filters),
        ]);
    }

    public function show(Request $request, Organization $organization, FinanceEntry $financeEntry, FinanceService $service): JsonResponse
    {
        $this->operate($request, $organization);

        return response()->json(['data' => $this->entry($financeEntry, $service->today($organization)->toDateString())]);
    }

    /** Prévia das parcelas (datas e valores revisáveis) antes de salvar. */
    public function preview(Request $request, Organization $organization, InstallmentPlanner $planner): JsonResponse
    {
        $this->operate($request, $organization);

        $data = $request->validate([
            'total_cents' => ['required', 'integer', 'min:1', 'max:100000000000'], 'count' => ['required', 'integer', 'between:1,120'],
            'first_due' => ['required', 'date'], 'periodicity' => ['nullable', Rule::in(array_keys(InstallmentPlanner::PERIODICITIES))],
        ]);

        return response()->json(['data' => $planner->plan((int) $data['total_cents'], (int) $data['count'], $data['first_due'], $data['periodicity'] ?? 'monthly')]);
    }

    public function store(Request $request, Organization $organization, FinanceService $service): JsonResponse
    {
        $this->operate($request, $organization);
        $this->defaults->ensure($organization);
        $id = $organization->getKey();

        $data = $request->validate([
            'type' => ['required', Rule::in(['receivable', 'payable'])], 'description' => ['required', 'string', 'min:3', 'max:190'],
            'category_id' => ['required', 'integer', Rule::exists('finance_categories', 'id')->where('organization_id', $id)],
            'student_id' => ['nullable', 'integer', Rule::exists('students', 'id')->where('organization_id', $id)],
            'partner_id' => ['nullable', 'integer', Rule::exists('partners', 'id')->where('organization_id', $id)],
            'party_id' => ['nullable', 'integer', Rule::exists('finance_parties', 'id')->where('organization_id', $id)],
            'enrollment_id' => ['nullable', 'integer', Rule::exists('enrollments', 'id')->where('organization_id', $id)],
            'vehicle_id' => ['nullable', 'integer', Rule::exists('vehicles', 'id')->where('organization_id', $id)],
            'maintenance_id' => ['nullable', 'integer', Rule::exists('vehicle_maintenances', 'id')->where('organization_id', $id)],
            'total_cents' => ['required', 'integer', 'min:1', 'max:100000000000'], 'issued_on' => ['required', 'date'],
            'plan' => ['nullable', 'array'], 'plan.count' => ['required_with:plan', 'integer', 'between:1,120'], 'plan.first_due' => ['required_with:plan', 'date'],
            'plan.periodicity' => ['nullable', Rule::in(array_keys(InstallmentPlanner::PERIODICITIES))],
            'installments' => ['nullable', 'array', 'max:120'], 'installments.*.due_date' => ['required', 'date'], 'installments.*.amount_cents' => ['required', 'integer', 'min:1'],
            'paid' => ['nullable', 'array'], 'paid.account_id' => ['required_with:paid', 'integer'], 'paid.method_id' => ['required_with:paid', 'integer'],
            'paid.paid_on' => ['nullable', 'date'], 'paid.reference' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        if ($data['type'] === 'receivable' && empty($data['student_id']) && empty($data['partner_id'])) {
            throw new BusinessRuleException('Informe quem paga: o aluno ou a auto escola parceira.', 'payer_required', 422);
        }

        if (isset($data['installments'])) {
            unset($data['plan']);
        } elseif (! isset($data['plan'])) {
            $data['plan'] = ['count' => 1, 'first_due' => $data['issued_on'], 'periodicity' => 'monthly'];
        }

        $entry = $service->createEntry($organization, $data);

        return response()->json(['data' => $this->entry($entry->refresh(), $service->today($organization)->toDateString())], 201);
    }

    public function update(Request $request, Organization $organization, FinanceEntry $financeEntry, FinanceService $service): JsonResponse
    {
        $this->operate($request, $organization);
        $id = $organization->getKey();

        $data = $request->validate([
            'description' => ['sometimes', 'string', 'min:3', 'max:190'],
            'category_id' => ['sometimes', 'integer', Rule::exists('finance_categories', 'id')->where('organization_id', $id)],
            'student_id' => ['nullable', 'integer', Rule::exists('students', 'id')->where('organization_id', $id)],
            'partner_id' => ['nullable', 'integer', Rule::exists('partners', 'id')->where('organization_id', $id)],
            'party_id' => ['nullable', 'integer', Rule::exists('finance_parties', 'id')->where('organization_id', $id)],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        return response()->json(['data' => $this->entry($service->updateEntry($financeEntry, $data)->refresh(), $service->today($organization)->toDateString())]);
    }

    public function cancel(Request $request, Organization $organization, FinanceEntry $financeEntry, FinanceService $service): JsonResponse
    {
        $this->manage($request, $organization);
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);

        return response()->json(['data' => $this->entry($service->cancelEntry($financeEntry, $data['reason'])->refresh(), $service->today($organization)->toDateString())]);
    }

    // ------------------------------------------------------------------------ parcelas e baixas

    public function updateInstallment(Request $request, Organization $organization, FinanceInstallment $financeInstallment, FinanceService $service): JsonResponse
    {
        $this->operate($request, $organization);
        $data = $request->validate(['due_date' => ['sometimes', 'date'], 'amount_cents' => ['sometimes', 'integer', 'min:1', 'max:100000000000']]);

        $installment = $service->updateInstallment($financeInstallment, $data);

        return response()->json(['data' => $this->entry($installment->entry->refresh(), $service->today($organization)->toDateString())]);
    }

    public function cancelInstallment(Request $request, Organization $organization, FinanceInstallment $financeInstallment, FinanceService $service): JsonResponse
    {
        $this->manage($request, $organization);
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);

        $installment = $service->cancelInstallment($financeInstallment, $data['reason']);

        return response()->json(['data' => $this->entry($installment->entry->refresh(), $service->today($organization)->toDateString())]);
    }

    /**
     * Baixa total, parcial ou dividida. `payments` aceita várias linhas (forma/conta/data diferentes) na mesma operação;
     * `client_ref` impede que o mesmo envio vire duas baixas.
     */
    public function pay(Request $request, Organization $organization, FinanceInstallment $financeInstallment, FinanceService $service): JsonResponse
    {
        $this->operate($request, $organization);
        $this->defaults->ensure($organization);

        $data = $request->validate([
            'payments' => ['required', 'array', 'min:1', 'max:10'],
            'payments.*.account_id' => ['required', 'integer'], 'payments.*.method_id' => ['required', 'integer'], 'payments.*.paid_on' => ['required', 'date'],
            'payments.*.applied_cents' => ['required', 'integer', 'min:1', 'max:100000000000'],
            'payments.*.discount_cents' => ['nullable', 'integer', 'min:0'], 'payments.*.interest_cents' => ['nullable', 'integer', 'min:0'],
            'payments.*.fine_cents' => ['nullable', 'integer', 'min:0'], 'payments.*.fee_cents' => ['nullable', 'integer', 'min:0'],
            'payments.*.adjust_reason' => ['nullable', 'string', 'max:255'], 'payments.*.reference' => ['nullable', 'string', 'max:100'],
            'payments.*.notes' => ['nullable', 'string', 'max:255'], 'payments.*.client_ref' => ['nullable', 'string', 'max:60'],
        ]);

        $payments = $service->recordPayments($organization, $financeInstallment, $data['payments']);

        return response()->json(['data' => $this->entry($financeInstallment->entry()->first(), $service->today($organization)->toDateString()), 'meta' => ['payment_ids' => collect($payments)->map->getKey()->all()]], 201);
    }

    public function confirm(Request $request, Organization $organization, FinancePayment $financePayment, FinanceService $service): JsonResponse
    {
        $this->operate($request, $organization);
        $data = $request->validate(['settled_on' => ['nullable', 'date']]);

        $payment = $service->confirmPayment($organization, $financePayment, $data['settled_on'] ?? null);

        return response()->json(['data' => FinancePresenter::payment($payment->load(['account', 'method']))]);
    }

    public function reverse(Request $request, Organization $organization, FinancePayment $financePayment, FinanceService $service): JsonResponse
    {
        $this->manage($request, $organization);
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);

        $payment = $service->reversePayment($organization, $financePayment, $data['reason']);

        return response()->json(['data' => $this->entry($payment->installment->entry()->first(), $service->today($organization)->toDateString())]);
    }

    /** Comprovante interno de recebimento (não é documento fiscal). */
    public function receipt(Request $request, Organization $organization, FinancePayment $financePayment): JsonResponse
    {
        $this->operate($request, $organization);
        $payment = $financePayment->load(['account', 'method', 'creator', 'installment.entry.student', 'installment.entry.partner', 'installment.entry.party']);
        $entry = $payment->installment->entry;

        return response()->json(['data' => [
            'number' => FinancePresenter::receiptNumber($payment),
            'kind' => $entry->isReceivable() ? 'Recibo de recebimento' : 'Comprovante de pagamento',
            'status' => $payment->status,
            'organization' => ['name' => $organization->name, 'document' => $organization->document, 'address' => $organization->address, 'city' => $organization->city, 'state' => $organization->state, 'phone' => $organization->phone],
            'counterparty' => ($entry->partner ?? $entry->student ?? $entry->party)?->name,
            'description' => $entry->description,
            'installment' => "{$payment->installment->number}/{$entry->installments_count}",
            'payment' => FinancePresenter::payment($payment),
            'notice' => 'Comprovante interno. Não substitui documento fiscal.',
        ]]);
    }

    /** @return array<string, mixed> */
    private function entry(FinanceEntry $entry, string $today): array
    {
        return FinancePresenter::entry($entry->load(['category', 'student', 'partner', 'party', 'creator', 'installments.payments.account', 'installments.payments.method', 'installments.payments.creator']), $today);
    }
}
