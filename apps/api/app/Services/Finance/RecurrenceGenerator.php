<?php

namespace App\Services\Finance;

use App\Exceptions\BusinessRuleException;
use App\Models\FinanceRecurrence;
use App\Models\Organization;
use Carbon\CarbonImmutable;

/**
 * Gera os lançamentos das recorrências mensais. Idempotente: cada mês tem a chave `recurrence:ID:AAAA-MM`, então
 * reprocessar (ou rodar duas vezes) não duplica. Gera até o mês seguinte ao atual.
 */
class RecurrenceGenerator
{
    public function __construct(private readonly FinanceService $service) {}

    /** @return int quantidade de lançamentos criados */
    public function run(Organization $organization, ?CarbonImmutable $today = null): int
    {
        $today ??= $this->service->today($organization);
        $horizon = $today->addMonthNoOverflow()->startOfMonth();
        $created = 0;

        foreach (FinanceRecurrence::query()->where('organization_id', $organization->getKey())->where('active', true)->get() as $recurrence) {
            $month = CarbonImmutable::parse($recurrence->starts_on->toDateString())->startOfMonth();

            while ($month <= $horizon) {
                $due = $month->day(min($recurrence->day_of_month, $month->daysInMonth));

                if ($due >= CarbonImmutable::parse($recurrence->starts_on->toDateString()) && ($recurrence->ends_on === null || $due <= CarbonImmutable::parse($recurrence->ends_on->toDateString()))) {
                    try {
                        $this->service->createEntry($organization, [
                            'type' => $recurrence->type, 'description' => $recurrence->description, 'category_id' => $recurrence->category_id,
                            'student_id' => $recurrence->student_id, 'partner_id' => $recurrence->partner_id, 'party_id' => $recurrence->party_id,
                            'recurrence_id' => $recurrence->getKey(), 'source_ref' => "recurrence:{$recurrence->getKey()}:{$month->format('Y-m')}",
                            'total_cents' => $recurrence->amount_cents, 'issued_on' => $due->toDateString(),
                            'plan' => ['count' => 1, 'first_due' => $due->toDateString()],
                        ]);
                        $created++;
                    } catch (BusinessRuleException $e) {
                        if ($e->errorCode !== 'entry_already_exists') {
                            throw $e;
                        }
                    }
                }

                $month = $month->addMonthNoOverflow();
            }
        }

        return $created;
    }
}
