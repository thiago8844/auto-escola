<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Exceptions\BusinessRuleException;
use App\Models\FinanceAccount;
use App\Models\FinanceCategory;
use App\Models\FinanceMovement;
use App\Models\FinanceParty;
use App\Models\FinancePaymentMethod;
use App\Models\FinanceReconciliation;
use App\Models\FinanceRecurrence;
use App\Models\Organization;
use App\Services\Audit;
use App\Services\Finance\FinancePresenter;
use App\Services\Finance\FinanceService;
use App\Services\Finance\RecurrenceGenerator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Cadastros do financeiro: contas/caixas, categorias, formas de pagamento, favorecidos e recorrências.
 * Cadastros nunca são apagados: inativar preserva o histórico.
 */
class CatalogController extends FinanceController
{
    // ------------------------------------------------------------------------ contas e caixas

    public function accounts(Request $request, Organization $organization, FinanceService $service): JsonResponse
    {
        $this->operate($request, $organization);

        return response()->json(['data' => $organization->financeAccounts()->orderByDesc('active')->orderBy('name')->get()
            ->map(fn (FinanceAccount $a) => FinancePresenter::account($a, $service->balance($a)))->all()]);
    }

    public function storeAccount(Request $request, Organization $organization, Audit $audit, FinanceService $service): JsonResponse
    {
        $this->manage($request, $organization);

        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:100', Rule::unique('finance_accounts', 'name')->where('organization_id', $organization->getKey())],
            'kind' => ['required', Rule::in(['bank', 'cash'])],
            'institution' => ['nullable', 'string', 'max:100'],
            'identification' => ['nullable', 'string', 'max:100'],
            'opening_balance_cents' => ['required', 'integer', 'between:-100000000000,100000000000'],
            'opening_date' => ['required', 'date', 'before_or_equal:'.$service->today($organization)->toDateString()],
        ]);

        $account = $organization->financeAccounts()->create($data + ['created_by' => $request->user()->getKey()]);
        $audit->record($organization->getKey(), 'finance.account_created', "Conta criada: {$account->name} (saldo inicial R$ ".number_format($account->opening_balance_cents / 100, 2, ',', '.').').', ['subject' => $account]);

        return response()->json(['data' => FinancePresenter::account($account, $account->opening_balance_cents)], 201);
    }

    public function updateAccount(Request $request, Organization $organization, FinanceAccount $financeAccount, FinanceService $service): JsonResponse
    {
        $this->manage($request, $organization);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:100', Rule::unique('finance_accounts', 'name')->where('organization_id', $organization->getKey())->ignore($financeAccount->getKey())],
            'institution' => ['nullable', 'string', 'max:100'],
            'identification' => ['nullable', 'string', 'max:100'],
            'active' => ['sometimes', 'boolean'],
            'opening_balance_cents' => ['sometimes', 'integer', 'between:-100000000000,100000000000'],
            'opening_date' => ['sometimes', 'date'],
        ]);

        // Saldo inicial só se corrige antes de existir movimento: depois disso, use ajuste (com motivo).
        if ((isset($data['opening_balance_cents']) || isset($data['opening_date']))
            && FinanceMovement::query()->where('account_id', $financeAccount->getKey())->exists()) {
            throw new BusinessRuleException('Esta conta já tem movimentações. Para corrigir o saldo use “Ajustar saldo”, que exige motivo e preserva o extrato.', 'account_has_movements', 422);
        }

        $financeAccount->update($data);

        return response()->json(['data' => FinancePresenter::account($financeAccount->refresh(), $service->balance($financeAccount))]);
    }

    public function adjust(Request $request, Organization $organization, FinanceAccount $financeAccount, FinanceService $service): JsonResponse
    {
        $this->manage($request, $organization);

        $data = $request->validate([
            'direction' => ['required', Rule::in(['in', 'out'])], 'amount_cents' => ['required', 'integer', 'min:1', 'max:100000000000'],
            'reason' => ['required', 'string', 'min:3', 'max:255'], 'occurred_on' => ['nullable', 'date'],
        ]);

        $service->adjust($organization, $financeAccount, $data['direction'], (int) $data['amount_cents'], $data['reason'], $data['occurred_on'] ?? null);

        return response()->json(['data' => FinancePresenter::account($financeAccount, $service->balance($financeAccount))], 201);
    }

    public function reconcile(Request $request, Organization $organization, FinanceAccount $financeAccount, FinanceService $service): JsonResponse
    {
        $this->manage($request, $organization);

        $data = $request->validate([
            'statement_date' => ['required', 'date', 'before_or_equal:'.$service->today($organization)->toDateString()],
            'statement_balance_cents' => ['required', 'integer', 'between:-100000000000,100000000000'],
            'movement_ids' => ['nullable', 'array', 'max:500'], 'movement_ids.*' => ['integer'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $record = $service->reconcile($organization, $financeAccount, $data['statement_date'], (int) $data['statement_balance_cents'], $data['movement_ids'] ?? [], $data['notes'] ?? null);

        return response()->json(['data' => $this->reconciliation($record)], 201);
    }

    public function reconciliations(Request $request, Organization $organization, FinanceAccount $financeAccount): JsonResponse
    {
        $this->operate($request, $organization);

        return response()->json(['data' => FinanceReconciliation::query()->where('account_id', $financeAccount->getKey())->orderByDesc('id')->limit(20)->get()->map(fn ($r) => $this->reconciliation($r))->all()]);
    }

    // ------------------------------------------------------------------------ categorias, formas, favorecidos

    public function categories(Request $request, Organization $organization): JsonResponse
    {
        $this->operate($request, $organization);
        $this->defaults->ensure($organization);

        return response()->json(['data' => $organization->financeCategories()->orderBy('type')->orderByDesc('active')->orderBy('name')->get()->map(fn ($c) => FinancePresenter::category($c))->all()]);
    }

    public function storeCategory(Request $request, Organization $organization): JsonResponse
    {
        $this->manage($request, $organization);

        $data = $request->validate([
            'type' => ['required', Rule::in(['income', 'expense'])],
            'name' => ['required', 'string', 'min:2', 'max:80', Rule::unique('finance_categories', 'name')->where('organization_id', $organization->getKey())->where('type', $request->input('type'))],
            'is_pass_through' => ['sometimes', 'boolean'],
        ]);

        return response()->json(['data' => FinancePresenter::category($organization->financeCategories()->create($data))], 201);
    }

    public function updateCategory(Request $request, Organization $organization, FinanceCategory $financeCategory): JsonResponse
    {
        $this->manage($request, $organization);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:80', Rule::unique('finance_categories', 'name')->where('organization_id', $organization->getKey())->where('type', $financeCategory->type)->ignore($financeCategory->getKey())],
            'is_pass_through' => ['sometimes', 'boolean'], 'active' => ['sometimes', 'boolean'],
        ]);
        $financeCategory->update($data);

        return response()->json(['data' => FinancePresenter::category($financeCategory->refresh())]);
    }

    public function methods(Request $request, Organization $organization): JsonResponse
    {
        $this->operate($request, $organization);
        $this->defaults->ensure($organization);

        return response()->json(['data' => $organization->financeMethods()->orderByDesc('active')->orderBy('id')->get()->map(fn ($m) => FinancePresenter::method($m))->all()]);
    }

    public function storeMethod(Request $request, Organization $organization): JsonResponse
    {
        $this->manage($request, $organization);

        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:60', Rule::unique('finance_payment_methods', 'name')->where('organization_id', $organization->getKey())],
            'kind' => ['required', Rule::in(['cash', 'pix', 'transfer', 'debit', 'credit', 'boleto', 'other'])],
            'settlement_days' => ['nullable', 'integer', 'between:0,120'],
        ]);

        return response()->json(['data' => FinancePresenter::method($organization->financeMethods()->create($data + ['settlement_days' => $data['settlement_days'] ?? 0]))], 201);
    }

    public function updateMethod(Request $request, Organization $organization, FinancePaymentMethod $financeMethod): JsonResponse
    {
        $this->manage($request, $organization);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:60', Rule::unique('finance_payment_methods', 'name')->where('organization_id', $organization->getKey())->ignore($financeMethod->getKey())],
            'settlement_days' => ['sometimes', 'integer', 'between:0,120'], 'active' => ['sometimes', 'boolean'],
        ]);
        $financeMethod->update($data);

        return response()->json(['data' => FinancePresenter::method($financeMethod->refresh())]);
    }

    public function parties(Request $request, Organization $organization): JsonResponse
    {
        $this->operate($request, $organization);

        return response()->json(['data' => $organization->financeParties()->when($request->filled('search'), fn ($q) => $q->where('name', 'like', '%'.$request->string('search').'%'))
            ->orderByDesc('active')->orderBy('name')->limit(200)->get()->map(fn ($p) => FinancePresenter::party($p))->all()]);
    }

    public function storeParty(Request $request, Organization $organization): JsonResponse
    {
        $this->operate($request, $organization);

        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:150'], 'document' => ['nullable', 'string', 'max:20'], 'email' => ['nullable', 'email', 'max:150'],
            'phone' => ['nullable', 'string', 'max:30'], 'notes' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json(['data' => FinancePresenter::party($organization->financeParties()->create($data))], 201);
    }

    public function updateParty(Request $request, Organization $organization, FinanceParty $financeParty): JsonResponse
    {
        $this->operate($request, $organization);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:150'], 'document' => ['nullable', 'string', 'max:20'], 'email' => ['nullable', 'email', 'max:150'],
            'phone' => ['nullable', 'string', 'max:30'], 'notes' => ['nullable', 'string', 'max:255'], 'active' => ['sometimes', 'boolean'],
        ]);
        $financeParty->update($data);

        return response()->json(['data' => FinancePresenter::party($financeParty->refresh())]);
    }

    // ------------------------------------------------------------------------ recorrências

    public function recurrences(Request $request, Organization $organization): JsonResponse
    {
        $this->operate($request, $organization);

        return response()->json(['data' => $organization->financeRecurrences()->orderByDesc('active')->orderBy('description')->get()->map(fn ($r) => FinancePresenter::recurrence($r))->all()]);
    }

    public function storeRecurrence(Request $request, Organization $organization, RecurrenceGenerator $generator): JsonResponse
    {
        $this->manage($request, $organization);
        $id = $organization->getKey();

        $data = $request->validate([
            'type' => ['required', Rule::in(['receivable', 'payable'])], 'description' => ['required', 'string', 'min:3', 'max:190'],
            'category_id' => ['required', 'integer', Rule::exists('finance_categories', 'id')->where('organization_id', $id)],
            'student_id' => ['nullable', 'integer', Rule::exists('students', 'id')->where('organization_id', $id)],
            'partner_id' => ['nullable', 'integer', Rule::exists('partners', 'id')->where('organization_id', $id)],
            'party_id' => ['nullable', 'integer', Rule::exists('finance_parties', 'id')->where('organization_id', $id)],
            'amount_cents' => ['required', 'integer', 'min:1', 'max:100000000000'], 'day_of_month' => ['required', 'integer', 'between:1,31'],
            'starts_on' => ['required', 'date'], 'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
        ]);

        if ($data['type'] === 'receivable' && empty($data['student_id']) && empty($data['partner_id'])) {
            throw new BusinessRuleException('Informe quem paga (aluno ou parceiro).', 'payer_required', 422);
        }

        $recurrence = $organization->financeRecurrences()->create($data + ['created_by' => $request->user()->getKey()]);
        $generator->run($organization);

        return response()->json(['data' => FinancePresenter::recurrence($recurrence)], 201);
    }

    /** Encerra a recorrência: o que já foi gerado permanece; nada novo é criado. */
    public function stopRecurrence(Request $request, Organization $organization, FinanceRecurrence $financeRecurrence): JsonResponse
    {
        $this->manage($request, $organization);
        $financeRecurrence->update(['active' => false]);

        return response()->json(['data' => FinancePresenter::recurrence($financeRecurrence->refresh())]);
    }

    /** @return array<string, mixed> */
    private function reconciliation(FinanceReconciliation $r): array
    {
        return [
            'id' => $r->getKey(), 'account_id' => $r->account_id, 'statement_date' => $r->statement_date->toDateString(),
            'statement_balance_cents' => $r->statement_balance_cents, 'system_balance_cents' => $r->system_balance_cents,
            'difference_cents' => $r->difference_cents, 'notes' => $r->notes, 'created_at' => $r->created_at?->toIso8601String(),
        ];
    }
}
