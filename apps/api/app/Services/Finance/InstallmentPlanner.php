<?php

namespace App\Services\Finance;

use App\Exceptions\BusinessRuleException;
use Carbon\CarbonImmutable;

/**
 * Divide um total em parcelas. A soma sempre fecha EXATAMENTE o total em centavos: a sobra da divisão é distribuída
 * de 1 em 1 centavo a partir da primeira parcela (R$ 100,00 em 3 → 33,34 + 33,33 + 33,33).
 */
class InstallmentPlanner
{
    public const PERIODICITIES = ['weekly' => 7, 'biweekly' => 14, 'monthly' => 0];

    /**
     * @return list<array{number: int, due_date: string, amount_cents: int}>
     */
    public function plan(int $totalCents, int $count, string $firstDue, string $periodicity = 'monthly'): array
    {
        if ($totalCents < 1 || $count < 1 || $count > 120 || $count > $totalCents) {
            throw new BusinessRuleException('Informe um valor total positivo e de 1 a 120 parcelas (cada uma de ao menos 1 centavo).', 'installment_plan_invalid', 422);
        }

        if (! array_key_exists($periodicity, self::PERIODICITIES)) {
            throw new BusinessRuleException('Periodicidade inválida.', 'installment_plan_invalid', 422);
        }

        $first = CarbonImmutable::parse($firstDue)->startOfDay();
        $base = intdiv($totalCents, $count);
        $extra = $totalCents % $count;
        $rows = [];

        for ($i = 0; $i < $count; $i++) {
            $due = $periodicity === 'monthly' ? $first->addMonthsNoOverflow($i) : $first->addDays(self::PERIODICITIES[$periodicity] * $i);
            $rows[] = ['number' => $i + 1, 'due_date' => $due->toDateString(), 'amount_cents' => $base + ($i < $extra ? 1 : 0)];
        }

        return $rows;
    }

    /**
     * Confere parcelas informadas manualmente (datas/valores revisados): soma exata e numeração sequencial.
     *
     * @param  list<array{due_date: string, amount_cents: int}>  $installments
     * @return list<array{number: int, due_date: string, amount_cents: int}>
     */
    public function validate(int $totalCents, array $installments): array
    {
        if ($installments === [] || count($installments) > 120) {
            throw new BusinessRuleException('Informe de 1 a 120 parcelas.', 'installment_plan_invalid', 422);
        }

        $sum = array_sum(array_map(fn ($i) => (int) $i['amount_cents'], $installments));

        if ($sum !== $totalCents) {
            throw new BusinessRuleException(
                'A soma das parcelas ('.number_format($sum / 100, 2, ',', '.').') deve ser igual ao total ('.number_format($totalCents / 100, 2, ',', '.').').',
                'installments_sum_mismatch',
                422,
            );
        }

        $rows = [];
        foreach (array_values($installments) as $i => $installment) {
            if ((int) $installment['amount_cents'] < 1) {
                throw new BusinessRuleException('Cada parcela precisa ter ao menos 1 centavo.', 'installment_plan_invalid', 422);
            }
            $rows[] = ['number' => $i + 1, 'due_date' => CarbonImmutable::parse($installment['due_date'])->toDateString(), 'amount_cents' => (int) $installment['amount_cents']];
        }

        return $rows;
    }
}
