<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\Alert;
use App\Models\Enrollment;
use App\Models\ExternalFee;
use App\Models\FinanceMovement;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\Student;
use App\Models\User;
use App\Services\AlertEngine;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Módulo 8 — financeiro básico.
 */
class FinanceTest extends ApiTestCase
{
    private User $owner;

    private Organization $org;

    private string $base;

    private string $today;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->org = $this->organizationWithOwner('cfc', $this->owner);
        $this->base = $this->prefix."/organizations/{$this->org->getKey()}/finance";
        $this->today = CarbonImmutable::now('America/Sao_Paulo')->toDateString();
    }

    private function api(string $method, string $path, array $body = [], ?User $as = null, string $prefix = '')
    {
        return $this->actingAsUser($as ?? $this->owner)->json($method, ($prefix ?: $this->base).$path, $body);
    }

    private function account(string $name, string $kind = 'bank', int $opening = 0): int
    {
        return $this->api('POST', '/accounts', ['name' => $name, 'kind' => $kind, 'opening_balance_cents' => $opening, 'opening_date' => CarbonImmutable::now('America/Sao_Paulo')->subDays(30)->toDateString()])
            ->assertCreated()->json('data.id');
    }

    /** @return array<string, int> id das formas por nome */
    private function methods(): array
    {
        return collect($this->api('GET', '/payment-methods')->assertOk()->json('data'))->pluck('id', 'name')->all();
    }

    private function category(string $type, string $name): int
    {
        return collect($this->api('GET', '/categories')->json('data'))->first(fn ($c) => $c['type'] === $type && $c['name'] === $name)['id'];
    }

    private function receivable(Student $student, int $total = 100000, int $count = 4, array $extra = [])
    {
        return $this->api('POST', '/entries', $extra + [
            'type' => 'receivable', 'description' => 'Contratação de aulas', 'category_id' => $this->category('income', 'Aulas e contratação'),
            'student_id' => $student->getKey(), 'total_cents' => $total, 'issued_on' => $this->today,
            'plan' => ['count' => $count, 'first_due' => CarbonImmutable::now('America/Sao_Paulo')->addDays(10)->toDateString(), 'periodicity' => 'monthly'],
        ]);
    }

    private function pay(int $installmentId, array $payments, ?User $as = null)
    {
        return $this->api('POST', "/installments/{$installmentId}/payments", ['payments' => $payments], $as);
    }

    private function line(int $account, int $method, int $cents, array $extra = []): array
    {
        return $extra + ['account_id' => $account, 'method_id' => $method, 'paid_on' => $this->today, 'applied_cents' => $cents];
    }

    public function test_aceite_four_installments_split_payment_expense_transfer_and_reversal_close_the_balances(): void
    {
        $methods = $this->methods();
        $bank = $this->account('Banco principal', 'bank', 50000);
        $cash = $this->account('Caixa', 'cash', 10000);
        $student = Student::factory()->for($this->org)->create();

        // R$ 1.000 em quatro parcelas de R$ 250.
        $entry = $this->receivable($student)->assertCreated();
        $installments = collect($entry->json('data.installments'));
        $this->assertSame([25000, 25000, 25000, 25000], $installments->pluck('amount_cents')->all());

        // Quitar a primeira com R$ 100 em dinheiro (caixa) e R$ 150 em Pix (banco); as demais ficam abertas.
        $first = $installments[0]['id'];
        $paid = $this->pay($first, [$this->line($cash, $methods['Dinheiro'], 10000), $this->line($bank, $methods['Pix'], 15000)])->assertCreated();
        $paid->assertJsonPath('data.installments.0.situation', 'paid')->assertJsonPath('data.installments.1.situation', 'forecast')
            ->assertJsonPath('data.paid_cents', 25000)->assertJsonPath('data.outstanding_cents', 75000);

        // Despesa parcelada (3x), quitando a primeira no banco.
        $expense = $this->api('POST', '/entries', [
            'type' => 'payable', 'description' => 'Compra de pneus', 'category_id' => $this->category('expense', 'Manutenção de veículos'),
            'total_cents' => 90000, 'issued_on' => $this->today, 'plan' => ['count' => 3, 'first_due' => $this->today],
        ])->assertCreated();
        $this->pay($expense->json('data.installments.0.id'), [$this->line($bank, $methods['Transferência bancária'], 30000)])->assertCreated();

        // Transferir R$ 200 do banco para o caixa e estornar um pagamento errado (o de R$ 100 em dinheiro).
        $this->api('POST', '/transfers', ['from_account_id' => $bank, 'to_account_id' => $cash, 'amount_cents' => 20000, 'occurred_on' => $this->today, 'reason' => 'Troco do dia'])->assertCreated();
        $wrong = collect($paid->json('data.installments.0.payments'))->first(fn ($p) => $p['applied_cents'] === 10000)['id'];
        $this->api('POST', "/payments/{$wrong}/reverse", ['reason' => 'Valor lançado errado'])->assertOk()
            ->assertJsonPath('data.installments.0.situation', 'partial')->assertJsonPath('data.installments.0.paid_cents', 15000);

        // Por conta: saldo inicial + entradas reais − saídas reais = saldo final.
        $bankStatement = $this->api('GET', "/accounts/{$bank}/statement?from={$this->today}&to={$this->today}")->assertOk()->json('data');
        // Entradas: 150 (Pix) ; saídas: 300 (pneus) + 200 (transferência).
        $this->assertSame(50000, $bankStatement['opening_balance_cents']);
        $this->assertSame(15000, $bankStatement['total_in_cents']);
        $this->assertSame(50000, $bankStatement['total_out_cents']);
        $this->assertSame(50000 + 15000 - 50000, $bankStatement['closing_balance_cents']);

        $cashStatement = $this->api('GET', "/accounts/{$cash}/statement?from={$this->today}&to={$this->today}")->json('data');
        // Entradas: 100 (dinheiro) + 200 (transferência); saídas: 100 (estorno). Original preservado + estorno visível.
        $this->assertSame(10000 + 30000 - 10000, $cashStatement['closing_balance_cents']);
        $this->assertCount(3, $cashStatement['lines']);
        $this->assertSame(1, collect($cashStatement['lines'])->where('kind', 'reversal')->count());

        // Consolidado: transferências não entram como faturamento nem como entrada/saída.
        $all = $this->api('GET', "/statement?from={$this->today}&to={$this->today}")->assertOk()->json('data');
        $this->assertSame(60000, $all['opening_balance_cents']);
        $this->assertSame($all['opening_balance_cents'] + $all['total_in_cents'] - $all['total_out_cents'], $all['closing_balance_cents']);
        $this->assertSame(20000, $all['transfers_cents']);
        // Faturamento = recebimentos − estorno = 150 (Pix); a transferência não soma. Parcelas abertas não alteram o realizado.
        $this->assertSame(15000, $all['realized']['receipts_cents']);
        $this->assertSame(30000, $all['realized']['payments_cents']);
        $this->assertSame($bankStatement['closing_balance_cents'] + $cashStatement['closing_balance_cents'], $all['closing_balance_cents']);
    }

    public function test_installments_sum_exactly_in_cents_and_manual_plans_must_match(): void
    {
        $student = Student::factory()->for($this->org)->create();
        $entry = $this->receivable($student, 10000, 3)->assertCreated();
        $this->assertSame([3334, 3333, 3333], collect($entry->json('data.installments'))->pluck('amount_cents')->all());

        $this->api('POST', '/entries/preview', ['total_cents' => 100, 'count' => 3, 'first_due' => $this->today, 'periodicity' => 'monthly'])
            ->assertOk()->assertJsonPath('data.0.amount_cents', 34)->assertJsonCount(3, 'data');

        $this->api('POST', '/entries', [
            'type' => 'receivable', 'description' => 'Manual', 'category_id' => $this->category('income', 'Serviços avulsos'), 'student_id' => $student->getKey(),
            'total_cents' => 10000, 'issued_on' => $this->today,
            'installments' => [['due_date' => $this->today, 'amount_cents' => 6000], ['due_date' => $this->today, 'amount_cents' => 3999]],
        ])->assertUnprocessable()->assertJsonPath('error', 'installments_sum_mismatch');

        $this->api('POST', '/entries/preview', ['total_cents' => 2, 'count' => 3, 'first_due' => $this->today])->assertUnprocessable();
        // Quem paga é obrigatório na receita.
        $this->api('POST', '/entries', ['type' => 'receivable', 'description' => 'Sem pagador', 'category_id' => $this->category('income', 'Serviços avulsos'), 'total_cents' => 1000, 'issued_on' => $this->today])
            ->assertUnprocessable()->assertJsonPath('error', 'payer_required');
    }

    public function test_partial_payments_on_different_dates_never_count_the_same_amount_twice(): void
    {
        $methods = $this->methods();
        $bank = $this->account('Banco');
        $student = Student::factory()->for($this->org)->create();
        $installment = $this->receivable($student, 30000, 1)->json('data.installments.0.id');

        $this->pay($installment, [$this->line($bank, $methods['Pix'], 10000, ['paid_on' => CarbonImmutable::parse($this->today)->subDays(5)->toDateString()])])->assertCreated()
            ->assertJsonPath('data.installments.0.situation', 'partial')->assertJsonPath('data.outstanding_cents', 20000);
        $this->pay($installment, [$this->line($bank, $methods['Pix'], 20000)])->assertCreated()->assertJsonPath('data.installments.0.situation', 'paid');

        // Quitada: nada mais pode ser baixado (sem duplicar).
        $this->pay($installment, [$this->line($bank, $methods['Pix'], 1)])->assertUnprocessable()->assertJsonPath('error', 'payment_exceeds_balance');
        $this->assertEquals(30000, FinanceMovement::query()->where('kind', 'payment_in')->sum('amount_cents'));
    }

    public function test_repeated_submission_or_concurrent_double_payment_is_recorded_once(): void
    {
        $methods = $this->methods();
        $bank = $this->account('Banco');
        $installment = $this->receivable(Student::factory()->for($this->org)->create(), 20000, 1)->json('data.installments.0.id');

        $line = $this->line($bank, $methods['Pix'], 20000, ['client_ref' => 'envio-0001']);
        $this->pay($installment, [$line])->assertCreated();
        $this->pay($installment, [$line])->assertCreated();           // mesma referência: devolve a mesma baixa
        $this->assertSame(1, \App\Models\FinancePayment::count());
        $this->assertEquals(20000, FinanceMovement::sum('amount_cents'));

        // E por Idempotency-Key no HTTP.
        $other = $this->receivable(Student::factory()->for($this->org)->create(), 5000, 1)->json('data.installments.0.id');
        $headers = ['Idempotency-Key' => 'chave-financeiro-0001'];
        $payload = ['payments' => [$this->line($bank, $methods['Pix'], 5000)]];
        $this->actingAsUser($this->owner)->postJson("{$this->base}/installments/{$other}/payments", $payload, $headers)->assertCreated();
        $this->actingAsUser($this->owner)->postJson("{$this->base}/installments/{$other}/payments", $payload, $headers)->assertCreated()->assertHeader('Idempotent-Replay', 'true');
        $this->assertSame(2, \App\Models\FinancePayment::count());
    }

    public function test_card_settlement_stays_forecast_until_confirmed_and_never_counts_as_available_cash(): void
    {
        $methods = $this->methods();
        $bank = $this->account('Banco', 'bank', 0);
        $installment = $this->receivable(Student::factory()->for($this->org)->create(), 40000, 1)->json('data.installments.0.id');

        $entry = $this->pay($installment, [$this->line($bank, $methods['Cartão de crédito'], 40000, ['fee_cents' => 1200, 'adjust_reason' => 'Taxa da maquininha'])])->assertCreated();
        $paymentId = $entry->json('data.installments.0.payments.0.id');
        $entry->assertJsonPath('data.installments.0.payments.0.status', 'pending')->assertJsonPath('data.installments.0.situation', 'paid');

        $this->assertSame(0, FinanceMovement::count());
        $overview = $this->api('GET', '/overview')->assertOk()->json('data');
        $this->assertSame(0, $overview['consolidated_balance_cents']);
        $this->assertSame(40000 - 1200, $overview['awaiting_settlement']['in_cents']);
        $this->assertSame(0, $overview['realized']['receipts_cents']);

        $this->api('POST', "/payments/{$paymentId}/confirm")->assertOk()->assertJsonPath('data.status', 'confirmed');
        $this->assertSame(40000 - 1200, $this->api('GET', '/overview')->json('data.consolidated_balance_cents'));
        $this->assertSame(40000, $this->api('GET', '/overview')->json('data.realized.receipts_cents'));
        $this->assertSame(1200, $this->api('GET', '/overview')->json('data.realized.fees_cents'));
        $this->api('POST', "/payments/{$paymentId}/confirm")->assertUnprocessable()->assertJsonPath('error', 'payment_not_pending');
    }

    public function test_discount_interest_fine_and_fee_need_a_reason_and_keep_gross_and_net_clear(): void
    {
        $methods = $this->methods();
        $bank = $this->account('Banco');
        $installment = $this->receivable(Student::factory()->for($this->org)->create(), 10000, 1)->json('data.installments.0.id');

        $this->pay($installment, [$this->line($bank, $methods['Pix'], 9000, ['discount_cents' => 1000])])->assertUnprocessable()->assertJsonPath('error', 'adjust_reason_required');

        // 90 pagos + 10 de desconto quitam a parcela; juros e multa entram além da parcela.
        $response = $this->pay($installment, [$this->line($bank, $methods['Pix'], 9000, ['discount_cents' => 1000, 'interest_cents' => 150, 'fine_cents' => 200, 'adjust_reason' => 'Desconto de pontualidade e atraso'])])->assertCreated();
        $response->assertJsonPath('data.installments.0.situation', 'paid')
            ->assertJsonPath('data.installments.0.payments.0.gross_cents', 9350)->assertJsonPath('data.installments.0.payments.0.net_cents', 9350);
        $this->assertSame(9350, $this->api('GET', "/accounts/{$bank}/statement?from={$this->today}&to={$this->today}")->json('data.closing_balance_cents'));
    }

    public function test_reversal_preserves_the_original_movement_and_cannot_repeat(): void
    {
        $methods = $this->methods();
        $bank = $this->account('Banco');
        $installment = $this->receivable(Student::factory()->for($this->org)->create(), 10000, 1)->json('data.installments.0.id');
        $payment = $this->pay($installment, [$this->line($bank, $methods['Pix'], 10000)])->json('data.installments.0.payments.0.id');

        $this->api('POST', "/payments/{$payment}/reverse", ['reason' => 'Pix devolvido'])->assertOk()->assertJsonPath('data.installments.0.situation', 'forecast');
        $this->assertSame(2, FinanceMovement::count());
        $this->assertDatabaseHas('finance_movements', ['kind' => 'payment_in', 'direction' => 'in']);
        $this->assertDatabaseHas('finance_movements', ['kind' => 'reversal', 'direction' => 'out']);
        $this->assertSame(0, $this->api('GET', "/accounts/{$bank}/statement?from={$this->today}&to={$this->today}")->json('data.closing_balance_cents'));
        $this->api('POST', "/payments/{$payment}/reverse", ['reason' => 'Outra vez'])->assertUnprocessable()->assertJsonPath('error', 'payment_already_reversed');

        // A parcela reaberta pode ser paga de novo.
        $this->pay($installment, [$this->line($bank, $methods['Pix'], 10000)])->assertCreated();
        $this->assertDatabaseHas('audit_events', ['event' => 'finance.payment_reversed']);
    }

    public function test_open_installments_can_be_edited_but_paid_ones_are_protected(): void
    {
        $methods = $this->methods();
        $bank = $this->account('Banco');
        $entry = $this->receivable(Student::factory()->for($this->org)->create(), 20000, 2)->json('data');
        [$a, $b] = [$entry['installments'][0]['id'], $entry['installments'][1]['id']];

        $this->api('PATCH', "/installments/{$b}", ['due_date' => CarbonImmutable::parse($this->today)->addDays(60)->toDateString(), 'amount_cents' => 12000])->assertOk()->assertJsonPath('data.total_cents', 22000);

        $this->pay($a, [$this->line($bank, $methods['Pix'], 10000)])->assertCreated();
        $this->api('PATCH', "/installments/{$a}", ['amount_cents' => 5000])->assertUnprocessable()->assertJsonPath('error', 'installment_has_payments');
        $this->api('POST', "/installments/{$a}/cancel", ['reason' => 'Engano'])->assertUnprocessable()->assertJsonPath('error', 'installment_has_payments');
        $this->api('POST', "/entries/{$entry['id']}/cancel", ['reason' => 'Engano'])->assertUnprocessable()->assertJsonPath('error', 'entry_has_payments');

        // Cancelar só a parcela aberta mantém o que já foi recebido.
        $this->api('POST', "/installments/{$b}/cancel", ['reason' => 'Aluno desistiu do restante'])->assertOk()->assertJsonPath('data.installments.1.situation', 'cancelled');
        $unpaid = $this->receivable(Student::factory()->for($this->org)->create(), 5000, 1)->json('data.id');
        $this->api('POST', "/entries/{$unpaid}/cancel", ['reason' => 'Duplicado'])->assertOk()->assertJsonPath('data.status', 'cancelled');
        $this->api('PATCH', "/entries/{$unpaid}", ['description' => 'Novo texto'])->assertUnprocessable();
    }

    public function test_situations_are_kept_apart_and_filters_totals_and_csv_reconcile(): void
    {
        $methods = $this->methods();
        $bank = $this->account('Banco');
        $student = Student::factory()->for($this->org)->create();
        $past = CarbonImmutable::parse($this->today)->subDays(10)->toDateString();

        $make = fn (string $desc, int $cents, string $due) => $this->api('POST', '/entries', [
            'type' => 'receivable', 'description' => $desc, 'category_id' => $this->category('income', 'Serviços avulsos'), 'student_id' => $student->getKey(),
            'total_cents' => $cents, 'issued_on' => $past, 'plan' => ['count' => 1, 'first_due' => $due],
        ])->assertCreated()->json('data');

        $overdue = $make('Atrasada', 10000, $past);
        $forecast = $make('Prevista', 20000, CarbonImmutable::parse($this->today)->addDays(5)->toDateString());
        $partial = $make('Parcial', 30000, CarbonImmutable::parse($this->today)->addDays(5)->toDateString());
        $paid = $make('Paga', 40000, $past);
        $cancelled = $make('Cancelada', 50000, $past);
        $this->pay($partial['installments'][0]['id'], [$this->line($bank, $methods['Pix'], 10000)])->assertCreated();
        $this->pay($paid['installments'][0]['id'], [$this->line($bank, $methods['Pix'], 40000)])->assertCreated();
        $this->api('POST', "/entries/{$cancelled['id']}/cancel", ['reason' => 'Teste'])->assertOk();

        $list = $this->api('GET', '/installments?type=receivable')->assertOk();
        $by = collect($list->json('data'))->pluck('situation', 'entry.description');
        $this->assertEquals(['Atrasada' => 'overdue', 'Prevista' => 'forecast', 'Parcial' => 'partial', 'Paga' => 'paid', 'Cancelada' => 'cancelled'], $by->all());
        $totals = $list->json('totals.by_situation');
        $this->assertSame(10000, $totals['overdue']['outstanding_cents']);
        $this->assertSame(20000, $totals['forecast']['outstanding_cents']);
        $this->assertSame(20000, $totals['partial']['outstanding_cents']);
        $this->assertSame(0, $totals['paid']['outstanding_cents']);
        $this->assertSame(0, $totals['cancelled']['outstanding_cents']);

        $this->api('GET', '/installments?situation=overdue,partial')->assertJsonPath('meta.total', 2)->assertJsonPath('totals.outstanding_cents', 30000);
        $this->api('GET', "/installments?q=Prevista&account_id={$bank}")->assertJsonPath('meta.total', 0);
        $this->api('GET', "/installments?account_id={$bank}&method_id={$methods['Pix']}")->assertJsonPath('meta.total', 2);

        $overview = $this->api('GET', '/overview')->json('data');
        $this->assertSame(10000 + 20000 + 20000, $overview['receivable']['outstanding_cents']);
        $this->assertSame(['count' => 1, 'cents' => 10000], $overview['receivable']['overdue']);
        $this->assertSame(50000, $overview['realized']['receipts_cents']);

        // CSV com o mesmo filtro e o mesmo total (sem as canceladas).
        $csv = $this->actingAsUser($this->owner)->get("{$this->base}/export/installments?type=receivable&situation=overdue,partial,forecast")->streamedContent();
        $lines = array_filter(explode("\n", trim($csv)));
        $this->assertStringStartsWith("\xEF\xBB\xBF", $csv);
        $this->assertCount(4, $lines);
        $this->assertSame(500.00, collect($lines)->skip(1)->sum(fn ($l) => (float) str_replace(',', '.', str_getcsv($l, ';')[8])) );
    }

    public function test_recurrence_generates_each_month_once_even_when_reprocessed(): void
    {
        $category = $this->category('expense', 'Aluguel e contas');
        $start = CarbonImmutable::parse($this->today)->subMonths(2)->startOfMonth()->toDateString();

        $this->api('POST', '/recurrences', ['type' => 'payable', 'description' => 'Aluguel do pátio', 'category_id' => $category, 'amount_cents' => 150000, 'day_of_month' => 31, 'starts_on' => $start])->assertCreated();
        $count = \App\Models\FinanceEntry::count();
        $this->assertGreaterThanOrEqual(3, $count);

        $this->artisan('finance:recurrences', ['--organization' => $this->org->getKey()])->assertSuccessful();
        $this->artisan('finance:recurrences')->assertSuccessful();
        $this->assertSame($count, \App\Models\FinanceEntry::count());
        // Dia 31 vira o último dia do mês curto.
        $this->assertTrue(\App\Models\FinanceInstallment::query()->whereMonth('due_date', 2)->get()->every(fn ($i) => in_array($i->due_date->day, [28, 29])));

        $id = \App\Models\FinanceRecurrence::firstOrFail()->getKey();
        $this->api('DELETE', "/recurrences/{$id}")->assertOk()->assertJsonPath('data.active', false);
    }

    public function test_enrollment_charge_and_maintenance_expense_use_a_unique_reference_and_never_duplicate(): void
    {
        $enrollment = $this->enrollmentFor($this->org);
        $enrollmentUrl = $this->prefix."/organizations/{$this->org->getKey()}/enrollments/{$enrollment->getKey()}";

        $this->api('POST', '/finance/charge', ['total_cents' => 100000], null, $enrollmentUrl)->assertUnprocessable()->assertJsonPath('error', 'no_package');

        $this->actingAsUser($this->owner)->postJson("{$enrollmentUrl}/packages", ['description' => 'Pacote 20 aulas', 'minutes' => 1200, 'price_cents' => 180000])->assertCreated();
        $first = $this->api('POST', '/finance/charge', ['plan' => ['count' => 3, 'first_due' => $this->today]], null, $enrollmentUrl)->assertCreated()
            ->assertJsonPath('data.total_cents', 180000)->assertJsonPath('data.source_ref', fn ($v) => str_starts_with($v, 'package:'));
        // Repetir a ação, editar a matrícula ou consumir aulas não cria outro título.
        $again = $this->api('POST', '/finance/charge', [], null, $enrollmentUrl)->assertStatus(409)->assertJsonPath('error', 'entry_already_exists');
        $this->assertSame($first->json('data.id'), $again->json('existing_entry_id'));
        $this->assertSame(1, \App\Models\FinanceEntry::count());
        $this->api('GET', '/finance', [], null, $enrollmentUrl)->assertOk()->assertJsonPath('data.charged_cents', 180000)->assertJsonPath('data.packages.0.charged', true);

        $vehicle = $this->vehicleFor($this->org);
        $maintenance = $this->actingAsUser($this->owner)->postJson($this->prefix."/organizations/{$this->org->getKey()}/maintenances", [
            'vehicle_id' => $vehicle->getKey(), 'type' => 'Revisão', 'scheduled_on' => $this->today, 'estimated_cost_cents' => 45000, 'provider' => 'Oficina Central',
        ])->assertCreated()->json('data.id');
        $maintenanceUrl = $this->prefix."/organizations/{$this->org->getKey()}/maintenances/{$maintenance}";
        $this->api('POST', '/finance/expense', [], null, $maintenanceUrl)->assertCreated()->assertJsonPath('data.total_cents', 45000)->assertJsonPath('data.type', 'payable');
        $this->api('POST', '/finance/expense', [], null, $maintenanceUrl)->assertStatus(409);
        $this->assertSame(2, \App\Models\FinanceEntry::count());
    }

    public function test_external_fee_advance_and_reimbursement_follow_the_charge_and_are_not_class_revenue(): void
    {
        $methods = $this->methods();
        $bank = $this->account('Banco');
        [$process] = $this->processWithEnrollment($this->org, $this->owner);
        $fee = ExternalFee::create([
            'organization_id' => $this->org->getKey(), 'qualification_process_id' => $process->getKey(), 'student_id' => $process->student_id,
            'kind' => 'Taxa do exame', 'amount_cents' => 18000, 'status' => 'confirmed', 'obligor' => 'student', 'paid_by' => 'organization',
        ]);
        $feeUrl = $this->prefix."/organizations/{$this->org->getKey()}/external-fees/{$fee->getKey()}";

        $this->api('POST', '/finance/advance', [], null, $feeUrl)->assertCreated()->assertJsonPath('data.category.is_pass_through', true);
        $charge = $this->api('POST', '/finance/reimbursement', [], null, $feeUrl)->assertCreated()->assertJsonPath('data.category.is_pass_through', true);
        $this->api('POST', '/finance/reimbursement', [], null, $feeUrl)->assertStatus(409);
        $this->assertSame('to_settle', $fee->fresh()->reimbursement);

        $this->api('GET', '/fee-advances')->assertOk()->assertJsonPath('data.0.reimbursement', 'to_settle')->assertJsonPath('data.0.to_settle_cents', 18000);

        $installment = $charge->json('data.installments.0.id');
        $paymentId = $this->pay($installment, [$this->line($bank, $methods['Pix'], 18000)])->json('data.installments.0.payments.0.id');
        $this->assertSame('settled', $fee->fresh()->reimbursement);

        // Reembolso recebido movimenta o caixa, mas não é faturamento de aula.
        $realized = $this->api('GET', '/overview')->json('data.realized');
        $this->assertSame(0, $realized['receipts_cents']);
        $this->assertSame(18000, $realized['pass_through_in_cents']);

        $this->api('POST', "/payments/{$paymentId}/reverse", ['reason' => 'Devolvido'])->assertOk();
        $this->assertSame('to_settle', $fee->fresh()->reimbursement);
    }

    public function test_partner_can_be_the_payer_and_has_its_own_receivables_statement(): void
    {
        $partnerId = $this->actingAsUser($this->owner)->postJson($this->prefix."/organizations/{$this->org->getKey()}/partners", ['name' => 'CFC Parceiro'])->assertCreated()->json('data.id');
        $student = Student::factory()->for($this->org)->create();

        // O aluno é quem recebe as aulas; o CFC parceiro é quem deve pagar.
        $this->receivable($student, 60000, 2, ['partner_id' => $partnerId])->assertCreated()->assertJsonPath('data.partner.id', $partnerId)->assertJsonPath('data.student.id', $student->getKey());
        $this->api('GET', "/partners/{$partnerId}")->assertOk()->assertJsonPath('data.receivable.total_cents', 60000)->assertJsonPath('data.receivable.outstanding_cents', 60000);
        $this->api('GET', "/installments?partner_id={$partnerId}")->assertJsonPath('meta.total', 2);

        $other = $this->organizationWithOwner();
        $this->actingAsUser($other->members()->first())->getJson($this->prefix."/organizations/{$other->getKey()}/finance/partners/{$partnerId}")->assertNotFound();
    }

    public function test_accounts_inactivate_without_losing_history_and_opening_balance_is_not_revenue(): void
    {
        $methods = $this->methods();
        $bank = $this->account('Banco', 'bank', 80000);
        $overview = $this->api('GET', '/overview')->json('data');
        $this->assertSame(80000, $overview['consolidated_balance_cents']);
        $this->assertSame(0, $overview['realized']['receipts_cents']);

        $this->api('PATCH', "/accounts/{$bank}", ['opening_balance_cents' => 90000])->assertOk();   // ainda sem movimento
        $installment = $this->receivable(Student::factory()->for($this->org)->create(), 1000, 1)->json('data.installments.0.id');
        $this->pay($installment, [$this->line($bank, $methods['Pix'], 1000)])->assertCreated();
        $this->api('PATCH', "/accounts/{$bank}", ['opening_balance_cents' => 1])->assertUnprocessable()->assertJsonPath('error', 'account_has_movements');

        // Pagamento anterior ao saldo inicial é recusado.
        $other = $this->receivable(Student::factory()->for($this->org)->create(), 1000, 1)->json('data.installments.0.id');
        $this->pay($other, [$this->line($bank, $methods['Pix'], 1000, ['paid_on' => CarbonImmutable::parse($this->today)->subDays(60)->toDateString()])])->assertUnprocessable()->assertJsonPath('error', 'payment_before_opening');

        $this->api('PATCH', "/accounts/{$bank}", ['active' => false])->assertOk();
        $this->pay($other, [$this->line($bank, $methods['Pix'], 1000)])->assertUnprocessable()->assertJsonPath('error', 'finance_inactive');
        $this->assertSame(91000, collect($this->api('GET', '/accounts')->json('data'))->first()['balance_cents']);

        // Ajuste exige motivo e preserva o extrato.
        $this->api('PATCH', "/accounts/{$bank}", ['active' => true])->assertOk();
        $this->api('POST', "/accounts/{$bank}/adjustments", ['direction' => 'out', 'amount_cents' => 500])->assertUnprocessable();
        $this->api('POST', "/accounts/{$bank}/adjustments", ['direction' => 'out', 'amount_cents' => 500, 'reason' => 'Tarifa bancária'])->assertCreated();
        $this->assertSame(90500, collect($this->api('GET', '/accounts')->json('data'))->first()['balance_cents']);
    }

    public function test_transfer_needs_both_ends_reverses_together_and_is_not_revenue_or_expense(): void
    {
        $a = $this->account('Banco A', 'bank', 100000);
        $b = $this->account('Caixa B', 'cash', 0);

        $this->api('POST', '/transfers', ['from_account_id' => $a, 'to_account_id' => $a, 'amount_cents' => 100, 'occurred_on' => $this->today, 'reason' => 'Mesma conta'])->assertUnprocessable()->assertJsonPath('error', 'transfer_same_account');
        $transfer = $this->api('POST', '/transfers', ['from_account_id' => $a, 'to_account_id' => $b, 'amount_cents' => 30000, 'occurred_on' => $this->today, 'reason' => 'Reforço do caixa'])->assertCreated()->json('data.id');
        $this->assertSame(2, FinanceMovement::where('transfer_id', $transfer)->count());

        $accounts = collect($this->api('GET', '/accounts')->json('data'))->pluck('balance_cents', 'name');
        $this->assertSame(70000, $accounts['Banco A']);
        $this->assertSame(30000, $accounts['Caixa B']);
        $realized = $this->api('GET', '/overview')->json('data.realized');
        $this->assertSame(0, $realized['receipts_cents'] + $realized['payments_cents']);

        $this->api('POST', "/transfers/{$transfer}/reverse", ['reason' => 'Lançada errada'])->assertOk();
        $accounts = collect($this->api('GET', '/accounts')->json('data'))->pluck('balance_cents', 'name');
        $this->assertSame(100000, $accounts['Banco A']);
        $this->assertSame(0, $accounts['Caixa B']);
        $this->api('POST', "/transfers/{$transfer}/reverse", ['reason' => 'De novo'])->assertUnprocessable()->assertJsonPath('error', 'transfer_already_reversed');
    }

    public function test_manual_reconciliation_shows_the_difference_to_the_external_statement(): void
    {
        $methods = $this->methods();
        $bank = $this->account('Banco', 'bank', 10000);
        $installment = $this->receivable(Student::factory()->for($this->org)->create(), 5000, 1)->json('data.installments.0.id');
        $this->pay($installment, [$this->line($bank, $methods['Pix'], 5000)])->assertCreated();
        $ids = FinanceMovement::pluck('id')->all();

        $this->api('POST', "/accounts/{$bank}/reconciliations", ['statement_date' => $this->today, 'statement_balance_cents' => 14000, 'movement_ids' => $ids, 'notes' => 'Extrato de outubro'])
            ->assertCreated()->assertJsonPath('data.system_balance_cents', 15000)->assertJsonPath('data.difference_cents', -1000);
        $this->assertSame(1, FinanceMovement::whereNotNull('reconciled_at')->count());
        $this->api('GET', "/accounts/{$bank}/reconciliations")->assertJsonCount(1, 'data');
    }

    public function test_permissions_matrix_and_isolation(): void
    {
        $methods = $this->methods();
        $bank = $this->account('Banco');
        $student = Student::factory()->for($this->org)->create();
        $entry = $this->receivable($student, 10000, 1)->json('data');

        $staff = User::factory()->create();
        $this->addMember($this->org, $staff, MembershipRole::Staff);
        $admin = User::factory()->create();
        $this->addMember($this->org, $admin, MembershipRole::Admin);
        $instructorUser = User::factory()->create();
        $instructor = Instructor::factory()->create(['user_id' => $instructorUser->getKey()]);
        $this->org->instructors()->attach($instructor->getKey(), ['active' => true]);
        $this->addMember($this->org, $instructorUser, MembershipRole::Instructor);
        $outsider = $this->organizationWithOwner()->members()->first();

        $matrix = [
            ['GET', '/overview', [], ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 403, 'outsider' => 404]],
            ['GET', '/accounts', [], ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 403, 'outsider' => 404]],
            ['GET', '/installments', [], ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 403, 'outsider' => 404]],
            ['POST', '/accounts', ['name' => 'Nova', 'kind' => 'bank', 'opening_balance_cents' => 0, 'opening_date' => $this->today], ['owner' => 201, 'admin' => 201, 'staff' => 403, 'instructor' => 403, 'outsider' => 404]],
            ['POST', '/transfers', ['from_account_id' => $bank, 'to_account_id' => $bank, 'amount_cents' => 1, 'occurred_on' => $this->today, 'reason' => 'Teste'], ['owner' => 422, 'admin' => 422, 'staff' => 403, 'instructor' => 403, 'outsider' => 404]],
            ['POST', "/entries/{$entry['id']}/cancel", [], ['owner' => 422, 'admin' => 422, 'staff' => 403, 'instructor' => 403, 'outsider' => 404]],
            ['POST', '/categories', ['type' => 'income', 'name' => 'Nova categoria'], ['owner' => 201, 'admin' => 201, 'staff' => 403, 'instructor' => 403, 'outsider' => 404]],
        ];
        $users = ['owner' => $this->owner, 'admin' => $admin, 'staff' => $staff, 'instructor' => $instructorUser, 'outsider' => $outsider];

        foreach ($matrix as [$method, $path, $body, $expected]) {
            foreach ($expected as $role => $status) {
                // Cadastros com nome único: cada papel usa o seu, para o teste medir permissão e não duplicidade.
                $payload = isset($body['name']) ? ['name' => $body['name'].' '.$role] + $body : $body;
                $response = $this->api($method, $path, $payload, $users[$role]);
                $this->assertSame($status, $response->status(), "{$method} {$path} como {$role}: esperado {$status}, veio {$response->status()}");
            }
        }

        // A equipe lança e dá baixa; só proprietário e gestor estornam.
        $installmentId = $entry['installments'][0]['id'];
        $paymentId = $this->pay($installmentId, [$this->line($bank, $methods['Pix'], 10000)], $staff)->assertCreated()->json('data.installments.0.payments.0.id');
        $this->api('POST', "/payments/{$paymentId}/reverse", ['reason' => 'Teste'], $staff)->assertForbidden();
        $this->api('POST', "/payments/{$paymentId}/reverse", ['reason' => 'Teste'], $admin)->assertOk();

        // Registros de outro espaço não são alcançáveis nem por ID em formulário.
        $foreign = $this->organizationWithOwner();
        $this->actingAsUser($foreign->members()->first())->getJson($this->prefix."/organizations/{$foreign->getKey()}/finance/entries/{$entry['id']}")->assertNotFound();
        $this->api('POST', '/entries', ['type' => 'receivable', 'description' => 'Intruso', 'category_id' => $this->category('income', 'Serviços avulsos'), 'student_id' => Student::factory()->for($foreign)->create()->getKey(), 'total_cents' => 100, 'issued_on' => $this->today])
            ->assertUnprocessable()->assertJsonValidationErrors('student_id');
    }

    public function test_finance_alerts_reach_only_those_with_finance_access(): void
    {
        $student = Student::factory()->for($this->org)->create();
        $this->api('POST', '/entries', [
            'type' => 'receivable', 'description' => 'Mensalidade', 'category_id' => $this->category('income', 'Serviços avulsos'), 'student_id' => $student->getKey(),
            'total_cents' => 7000, 'issued_on' => $this->today, 'plan' => ['count' => 1, 'first_due' => CarbonImmutable::parse($this->today)->subDays(3)->toDateString()],
        ])->assertCreated();

        app(AlertEngine::class)->run($this->org);
        $this->assertSame(1, Alert::where('kind', 'receivable.overdue')->count());

        $base = $this->prefix."/organizations/{$this->org->getKey()}";
        $this->actingAsUser($this->owner)->getJson("{$base}/alerts?category=finance")->assertJsonCount(1, 'data')->assertJsonPath('data.0.subject.type', 'receivable');

        $instructorUser = User::factory()->create();
        $instructor = Instructor::factory()->create(['user_id' => $instructorUser->getKey()]);
        $this->org->instructors()->attach($instructor->getKey(), ['active' => true]);
        $this->addMember($this->org, $instructorUser, MembershipRole::Instructor);
        $this->actingAsUser($instructorUser)->getJson("{$base}/alerts?category=finance")->assertJsonCount(0, 'data');
    }

    public function test_attachments_can_be_linked_to_entries_and_payments_privately(): void
    {
        Storage::fake(config('autoescola.documents_disk'));
        $methods = $this->methods();
        $bank = $this->account('Banco');
        $entry = $this->receivable(Student::factory()->for($this->org)->create(), 1000, 1)->json('data');
        $paymentId = $this->pay($entry['installments'][0]['id'], [$this->line($bank, $methods['Pix'], 1000)])->json('data.installments.0.payments.0.id');

        $docs = $this->prefix."/organizations/{$this->org->getKey()}/documents";
        $this->actingAsUser($this->owner)->postJson($docs, ['file' => UploadedFile::fake()->create('comprovante.pdf', 10, 'application/pdf'), 'type' => 'payment_proof', 'finance_payment_id' => $paymentId])
            ->assertCreated()->assertJsonPath('data.finance_payment_id', $paymentId);
        $this->actingAsUser($this->owner)->postJson($docs, ['file' => UploadedFile::fake()->create('contrato.pdf', 10, 'application/pdf'), 'type' => 'contract', 'finance_entry_id' => $entry['id']])->assertCreated();
        $this->actingAsUser($this->owner)->getJson("{$docs}?finance_entry_id={$entry['id']}")->assertJsonCount(1, 'data');
    }

    public function test_receipt_has_a_number_and_identifies_the_operation_and_reports_break_down_by_group(): void
    {
        $methods = $this->methods();
        $bank = $this->account('Banco');
        $student = Student::factory()->for($this->org)->create(['name' => 'Maria Souza']);
        $entry = $this->receivable($student, 20000, 1)->json('data');
        $paymentId = $this->pay($entry['installments'][0]['id'], [$this->line($bank, $methods['Pix'], 20000, ['reference' => 'E2E123'])])->json('data.installments.0.payments.0.id');

        $receipt = $this->api('GET', "/payments/{$paymentId}/receipt")->assertOk()->json('data');
        $this->assertMatchesRegularExpression('/^RC-\d{4}-\d{6}$/', $receipt['number']);
        $this->assertSame('Maria Souza', $receipt['counterparty']);
        $this->assertSame('E2E123', $receipt['payment']['reference']);
        $this->assertStringContainsString('fiscal', $receipt['notice']);

        foreach (['category' => 'Aulas e contratação', 'student' => 'Maria Souza', 'method' => 'Pix', 'account' => 'Banco'] as $by => $label) {
            $rows = $this->api('GET', "/breakdown?by={$by}&from={$this->today}&to={$this->today}")->assertOk()->json('data.rows');
            $this->assertSame($label, $rows[0]['label']);
            $this->assertSame(20000, $rows[0]['received_cents']);
        }

        $flow = $this->api('GET', "/cash-flow?from={$this->today}&to={$this->today}")->json('data.rows');
        $this->assertSame(20000, $flow[0]['realized_in_cents']);
        $this->assertSame(0, $flow[0]['forecast_in_cents']);
    }
}
