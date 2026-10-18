<?php

namespace Tests\Feature\Api;

use App\Models\Enrollment;
use App\Models\PracticalExam;
use App\Models\User;
use Carbon\CarbonImmutable;

class UxPresentationTest extends ApiTestCase
{
    public function test_dashboard_separates_full_totals_from_the_five_upcoming_exams(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-18 09:00', 'America/Sao_Paulo'));
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        [$process, $enrollment] = $this->processWithEnrollment($organization, $owner);
        $enrollment->update(['status' => 'in_service']);
        Enrollment::create(['organization_id' => $organization->getKey(), 'student_id' => $enrollment->student_id, 'category' => 'A', 'status' => 'in_service']);
        foreach (range(1, 8) as $attempt) {
            PracticalExam::create([
                'organization_id' => $organization->getKey(), 'student_id' => $enrollment->student_id,
                'qualification_process_id' => $process->getKey(), 'category' => 'B', 'attempt_number' => $attempt,
                'scheduled_at' => now()->addDays($attempt), 'duration_minutes' => 60, 'status' => 'scheduled',
            ]);
        }

        $this->actingAsUser($owner)->getJson("{$this->prefix}/organizations/{$organization->getKey()}/reports/dashboard")
            ->assertOk()->assertJsonPath('data.students_in_service', 1)->assertJsonPath('data.enrollments_in_service', 2)
            ->assertJsonPath('data.upcoming_exams_total', 8)->assertJsonCount(5, 'data.upcoming_exams')
            ->assertJsonPath('data.upcoming_exams_period.to', '2026-10-31');
    }

    public function test_older_package_is_charged_without_marking_the_newer_package_as_charged(): void
    {
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        $enrollment = $this->enrollmentFor($organization);
        $url = "{$this->prefix}/organizations/{$organization->getKey()}/enrollments/{$enrollment->getKey()}";
        $this->actingAsUser($owner);
        $this->postJson("{$url}/packages", ['description' => 'Primeiro pacote', 'minutes' => 500, 'price_cents' => 100000])->assertCreated();
        $this->postJson("{$url}/packages", ['description' => 'Acréscimo', 'minutes' => 250, 'price_cents' => 50000])->assertCreated();
        $older = $this->getJson("{$url}/finance")->assertOk()->json('data.packages.0.id');
        $newer = $this->getJson("{$url}/finance")->assertOk()->json('data.packages.1.id');

        $this->postJson("{$url}/finance/charge", ['package_id' => $older])->assertCreated()
            ->assertJsonPath('data.source_ref', "package:{$older}")->assertJsonPath('data.total_cents', 100000);

        $this->getJson("{$url}/finance")->assertOk()->assertJsonPath('data.packages.0.charged', true)->assertJsonPath('data.packages.1.charged', false);
        $this->postJson("{$url}/finance/charge", ['package_id' => $newer])->assertCreated()
            ->assertJsonPath('data.source_ref', "package:{$newer}")->assertJsonPath('data.total_cents', 50000);
        $this->assertDatabaseCount('finance_entries', 2);
    }

    public function test_installment_list_explains_pending_settlement_and_receipt_identifies_the_origin(): void
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-18 09:00', 'America/Sao_Paulo'));
        $owner = User::factory()->create();
        $organization = $this->organizationWithOwner('cfc', $owner);
        $enrollment = $this->enrollmentFor($organization);
        $base = "{$this->prefix}/organizations/{$organization->getKey()}/finance";
        $this->actingAsUser($owner);
        $account = $this->postJson("{$base}/accounts", ['name' => 'Banco', 'kind' => 'bank', 'opening_balance_cents' => 0, 'opening_date' => '2026-10-18'])->assertCreated()->json('data.id');
        $category = collect($this->getJson("{$base}/categories")->json('data'))->firstWhere('type', 'income')['id'];
        $method = collect($this->getJson("{$base}/payment-methods")->json('data'))->firstWhere('settlement_days', 30)['id'];
        $entry = $this->postJson("{$base}/entries", [
            'type' => 'receivable', 'description' => 'Contratação', 'category_id' => $category,
            'student_id' => $enrollment->student_id, 'total_cents' => 10000, 'issued_on' => '2026-10-18',
        ])->assertCreated()->json('data');
        $payment = $this->postJson("{$base}/installments/{$entry['installments'][0]['id']}/payments", ['payments' => [[
            'account_id' => $account, 'method_id' => $method, 'paid_on' => '2026-10-18', 'applied_cents' => 10000,
        ]]])->assertCreated()->json('data.installments.0.payments.0.id');

        $this->getJson("{$base}/installments")->assertOk()->assertJsonPath('data.0.situation', 'paid')
            ->assertJsonPath('data.0.awaiting_settlement_cents', 10000);
        $this->getJson("{$base}/payments/{$payment}/receipt")->assertOk()
            ->assertJsonPath('data.entry_type', 'receivable')->assertJsonPath('data.entry_id', $entry['id']);
    }
}
