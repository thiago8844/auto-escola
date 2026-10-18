<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Enums\FeeParty;
use App\Exceptions\BusinessRuleException;
use App\Models\Enrollment;
use App\Models\EnrollmentPackage;
use App\Models\ExternalFee;
use App\Models\FinanceEntry;
use App\Models\Organization;
use App\Models\VehicleMaintenance;
use App\Services\Finance\FinanceDefaults;
use App\Services\Finance\FinancePresenter;
use App\Services\Finance\FinanceService;
use App\Services\Finance\InstallmentPlanner;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Cobrança/despesa geradas a partir de outros módulos, sempre por AÇÃO EXPLÍCITA e com referência única:
 * contratação (`package:ID`), manutenção (`maintenance:UUID`) e taxa externa (`fee:ID:reimbursement|advance`).
 * Repetir a ação, editar a contratação ou consumir aulas nunca cria um segundo título: a API responde
 * `409 entry_already_exists` apontando o lançamento que já existe.
 */
class IntegrationController extends FinanceController
{
    /** @return array<string, mixed> */
    private function planRules(): array
    {
        return [
            'total_cents' => ['nullable', 'integer', 'min:1', 'max:100000000000'], 'issued_on' => ['nullable', 'date'],
            'plan' => ['nullable', 'array'], 'plan.count' => ['required_with:plan', 'integer', 'between:1,120'], 'plan.first_due' => ['required_with:plan', 'date'],
            'plan.periodicity' => ['nullable', Rule::in(array_keys(InstallmentPlanner::PERIODICITIES))],
            'installments' => ['nullable', 'array', 'max:120'], 'installments.*.due_date' => ['required', 'date'], 'installments.*.amount_cents' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function enrollmentSummary(Request $request, Organization $organization, Enrollment $enrollment, FinanceService $service): JsonResponse
    {
        $this->operate($request, $organization);
        $today = $service->today($organization)->toDateString();

        $entries = FinanceEntry::query()->where('organization_id', $organization->getKey())->where('enrollment_id', $enrollment->getKey())
            ->with(['category', 'student', 'partner', 'party', 'creator', 'installments.payments.account', 'installments.payments.method'])->orderBy('id')->get();
        $active = $entries->where('status', 'active');

        return response()->json(['data' => [
            'entries' => $entries->map(fn ($e) => FinancePresenter::entry($e, $today))->all(),
            'charged_cents' => (int) $active->where('type', 'receivable')->sum('total_cents'),
            'received_cents' => (int) $active->where('type', 'receivable')->sum(fn ($e) => $e->installments->sum('paid_cents')),
            'packages' => EnrollmentPackage::query()->where('enrollment_id', $enrollment->getKey())->orderBy('id')->get()->map(fn ($p) => [
                'id' => $p->getKey(), 'description' => $p->description, 'price_cents' => $p->price_cents, 'charged' => $entries->contains('source_ref', "package:{$p->getKey()}"),
            ])->all(),
        ]]);
    }

    public function chargeEnrollment(Request $request, Organization $organization, Enrollment $enrollment, FinanceService $service): JsonResponse
    {
        $this->operate($request, $organization);

        $data = $request->validate($this->planRules() + [
            'package_id' => ['nullable', 'integer'], 'payer' => ['nullable', Rule::in(['student', 'partner'])],
        ]);

        $package = EnrollmentPackage::query()->where('enrollment_id', $enrollment->getKey())->when($data['package_id'] ?? null, fn ($q, $v) => $q->whereKey($v))->orderByDesc('id')->first();

        if ($package === null) {
            throw new BusinessRuleException('Esta matrícula ainda não tem contratação. Registre o pacote de aulas antes de cobrar.', 'no_package', 422);
        }

        $total = (int) ($data['total_cents'] ?? $package->price_cents ?? 0);

        if ($total < 1) {
            throw new BusinessRuleException('Informe o valor a cobrar: a contratação não tem valor.', 'charge_amount_required', 422);
        }

        $payerIsPartner = ($data['payer'] ?? 'student') === 'partner';

        if ($payerIsPartner && $enrollment->partner_id === null) {
            throw new BusinessRuleException('Esta matrícula não tem parceiro. Escolha o aluno como pagador.', 'partner_required', 422);
        }

        $category = $this->defaults->category($organization, 'income', FinanceDefaults::CATEGORY_TUITION, false);

        return $this->create($organization, $service, $data + [
            'type' => 'receivable', 'description' => 'Contratação: '.($package->description ?: 'pacote de aulas'),
            'category_id' => $category->getKey(), 'student_id' => $enrollment->student_id, 'partner_id' => $payerIsPartner ? $enrollment->partner_id : null,
            'enrollment_id' => $enrollment->getKey(), 'source_ref' => "package:{$package->getKey()}", 'total_cents' => $total,
        ]);
    }

    public function maintenanceExpense(Request $request, Organization $organization, VehicleMaintenance $maintenance, FinanceService $service): JsonResponse
    {
        $this->operate($request, $organization);

        $data = $request->validate($this->planRules() + ['party_id' => ['nullable', 'integer', Rule::exists('finance_parties', 'id')->where('organization_id', $organization->getKey())], 'due_date' => ['nullable', 'date']]);
        $total = (int) ($data['total_cents'] ?? $maintenance->actual_cost_cents ?? $maintenance->estimated_cost_cents ?? 0);

        if ($total < 1) {
            throw new BusinessRuleException('Informe o valor: a manutenção não tem custo estimado nem real.', 'charge_amount_required', 422);
        }

        $category = $this->defaults->category($organization, 'expense', FinanceDefaults::CATEGORY_MAINTENANCE, false);
        $due = $data['due_date'] ?? $maintenance->performed_on?->toDateString() ?? $maintenance->scheduled_on->toDateString();

        return $this->create($organization, $service, $data + [
            'type' => 'payable', 'description' => "Manutenção: {$maintenance->type}".($maintenance->provider ? " ({$maintenance->provider})" : ''),
            'category_id' => $category->getKey(), 'vehicle_id' => $maintenance->vehicle_id, 'maintenance_id' => $maintenance->getKey(),
            'source_ref' => "maintenance:{$maintenance->finance_ref}", 'total_cents' => $total, 'issued_on' => $due, 'plan' => $data['plan'] ?? ['count' => 1, 'first_due' => $due],
        ]);
    }

    /** O espaço adiantou a taxa do aluno: cobra o reembolso (sem virar receita de aula). */
    public function feeReimbursement(Request $request, Organization $organization, ExternalFee $externalFee, FinanceService $service): JsonResponse
    {
        $this->operate($request, $organization);
        $data = $request->validate($this->planRules());

        if ($externalFee->paid_by !== FeeParty::Organization) {
            throw new BusinessRuleException('Só se cobra reembolso de taxa que o espaço adiantou. Confirme a taxa informando que o espaço pagou.', 'fee_not_advanced', 422);
        }

        $total = (int) ($data['total_cents'] ?? $externalFee->amount_cents ?? 0);

        if ($total < 1) {
            throw new BusinessRuleException('A taxa não tem valor. Informe o valor a reembolsar.', 'charge_amount_required', 422);
        }

        $category = $this->defaults->category($organization, 'income', FinanceDefaults::CATEGORY_REIMBURSEMENT, true);
        $today = $service->today($organization)->toDateString();
        $response = $this->create($organization, $service, $data + [
            'type' => 'receivable', 'description' => "Reembolso de taxa: {$externalFee->kind}", 'category_id' => $category->getKey(),
            'student_id' => $externalFee->student_id, 'external_fee_id' => $externalFee->getKey(), 'source_ref' => "fee:{$externalFee->getKey()}:reimbursement",
            'total_cents' => $total, 'issued_on' => $data['issued_on'] ?? $today, 'plan' => $data['plan'] ?? ['count' => 1, 'first_due' => $externalFee->due_date?->toDateString() ?? $today],
        ]);

        if ($response->getStatusCode() === 201) {
            $externalFee->forceFill(['reimbursement' => 'to_settle'])->save();
        }

        return $response;
    }

    /** O espaço pagou a taxa por conta do aluno: lança a saída (adiantamento), separada da receita de aula. */
    public function feeAdvance(Request $request, Organization $organization, ExternalFee $externalFee, FinanceService $service): JsonResponse
    {
        $this->operate($request, $organization);
        $data = $request->validate($this->planRules() + ['party_id' => ['nullable', 'integer', Rule::exists('finance_parties', 'id')->where('organization_id', $organization->getKey())]]);
        $total = (int) ($data['total_cents'] ?? $externalFee->amount_cents ?? 0);

        if ($total < 1) {
            throw new BusinessRuleException('A taxa não tem valor. Informe o valor adiantado.', 'charge_amount_required', 422);
        }

        $category = $this->defaults->category($organization, 'expense', FinanceDefaults::CATEGORY_FEE_ADVANCE, true);
        $today = $service->today($organization)->toDateString();

        return $this->create($organization, $service, $data + [
            'type' => 'payable', 'description' => "Taxa externa adiantada: {$externalFee->kind}", 'category_id' => $category->getKey(),
            'student_id' => $externalFee->student_id, 'external_fee_id' => $externalFee->getKey(), 'source_ref' => "fee:{$externalFee->getKey()}:advance",
            'total_cents' => $total, 'issued_on' => $data['issued_on'] ?? $today, 'plan' => $data['plan'] ?? ['count' => 1, 'first_due' => $externalFee->due_date?->toDateString() ?? $today],
        ]);
    }

    /** @param array<string, mixed> $data */
    private function create(Organization $organization, FinanceService $service, array $data): JsonResponse
    {
        $data['issued_on'] ??= $service->today($organization)->toDateString();

        if (isset($data['installments'])) {
            unset($data['plan']);
        } elseif (empty($data['plan'])) {
            $data['plan'] = ['count' => 1, 'first_due' => $data['issued_on'], 'periodicity' => 'monthly'];
        }

        try {
            $entry = $service->createEntry($organization, $data);
        } catch (BusinessRuleException $e) {
            if ($e->errorCode === 'entry_already_exists') {
                $existing = $service->findBySourceRef($organization, $data['source_ref']);

                return response()->json([
                    'message' => 'Este lançamento já foi gerado. Abra o existente em vez de criar outro.', 'error' => 'entry_already_exists', 'existing_entry_id' => $existing?->getKey(),
                ], 409);
            }

            throw $e;
        }

        return response()->json(['data' => FinancePresenter::entry($entry->refresh()->load(['category', 'student', 'partner', 'party', 'creator', 'installments.payments']), $service->today($organization)->toDateString())], 201);
    }
}
