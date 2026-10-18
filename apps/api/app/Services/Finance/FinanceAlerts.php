<?php

namespace App\Services\Finance;

use App\Models\FinanceInstallment;
use App\Models\FinancePayment;
use App\Models\Organization;
use Carbon\CarbonImmutable;

/**
 * Alertas financeiros para a central de pendências (módulo 5): parcelas a vencer e em atraso e liquidações de
 * cartão/boleto que passaram da previsão sem confirmação. Só aparecem para quem tem acesso ao financeiro
 * (público `finance`: proprietário, gestor e equipe; nunca o instrutor).
 */
class FinanceAlerts
{
    /**
     * @param  array<string, int|bool>  $config
     * @return iterable<array<string, mixed>>
     */
    public function detect(Organization $organization, CarbonImmutable $now, CarbonImmutable $today, string $timezone, array $config): iterable
    {
        $limit = $today->addDays((int) ($config['finance_lead_days'] ?? 5))->toDateString();

        $installments = FinanceInstallment::query()
            ->join('finance_entries', 'finance_entries.id', '=', 'finance_installments.entry_id')
            ->where('finance_installments.organization_id', $organization->getKey())
            ->where('finance_installments.status', 'open')->where('finance_entries.status', 'active')
            ->whereDate('finance_installments.due_date', '<=', $limit)
            ->select('finance_installments.*')->with('entry.student:id,name', 'entry.partner:id,name', 'entry.party:id,name')
            ->orderBy('finance_installments.due_date')->limit(300)->get();

        foreach ($installments as $installment) {
            $entry = $installment->entry;
            $receivable = $entry->isReceivable();
            $who = ($entry->partner ?? $entry->student ?? $entry->party)?->name;
            $due = CarbonImmutable::parse($installment->due_date->toDateString(), $timezone);
            $days = (int) $today->diffInDays($due, false);
            $overdue = $days < 0;
            $amount = 'R$ '.number_format($installment->outstandingCents() / 100, 2, ',', '.');

            yield [
                'dedup_key' => "installment:{$installment->getKey()}:".($overdue ? 'overdue' : 'due').":{$due->toDateString()}",
                'kind' => ($receivable ? 'receivable' : 'payable').($overdue ? '.overdue' : '.due'),
                'category' => 'finance',
                'priority' => $overdue ? 'high' : 'normal',
                'title' => ($receivable ? 'Recebimento ' : 'Pagamento ').($overdue ? 'atrasado' : ($days === 0 ? 'vence hoje' : "vence em {$days} ".($days === 1 ? 'dia' : 'dias'))).($who ? ": {$who}" : ''),
                'message' => "{$entry->description}, parcela {$installment->number}/{$entry->installments_count}: {$amount} ".($overdue ? 'venceu em ' : 'vence em ').$due->format('d/m/Y').'.',
                'audience' => 'finance',
                'instructor_id' => null,
                'subject_type' => $receivable ? 'receivable' : 'payable',
                'subject_id' => $entry->getKey(),
                'due_on' => $due->toDateString(),
            ];
        }

        $stale = FinancePayment::query()->where('organization_id', $organization->getKey())->where('status', 'pending')
            ->whereDate('expected_on', '<', $today->toDateString())->with('installment.entry')->limit(100)->get();

        foreach ($stale as $payment) {
            $entry = $payment->installment->entry;

            yield [
                'dedup_key' => "payment:{$payment->getKey()}:settlement",
                'kind' => 'finance.settlement_pending', 'category' => 'finance', 'priority' => 'normal',
                'title' => 'Liquidação aguardando confirmação',
                'message' => "{$entry->description}: previsão de ".$payment->expected_on->format('d/m/Y').'. Confirme quando o dinheiro estiver na conta.',
                'audience' => 'finance', 'instructor_id' => null,
                'subject_type' => $entry->isReceivable() ? 'receivable' : 'payable', 'subject_id' => $entry->getKey(), 'due_on' => $payment->expected_on->toDateString(),
            ];
        }
    }
}
