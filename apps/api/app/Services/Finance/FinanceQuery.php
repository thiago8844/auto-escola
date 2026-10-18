<?php

namespace App\Services\Finance;

use App\Models\FinanceInstallment;
use App\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Consulta de parcelas com filtros e situação derivada. A mesma consulta alimenta a lista, os totais, o painel e o CSV,
 * então os números sempre conciliam.
 *
 * Situação (uma só por parcela, nesta ordem de precedência):
 *   cancelled  → cancelada (ou lançamento cancelado)
 *   paid       → quitada
 *   overdue    → vencida: venceu e ainda falta pagar
 *   partial    → parcialmente paga (dentro do prazo)
 *   forecast   → prevista: em aberto, dentro do prazo
 */
class FinanceQuery
{
    public const SITUATIONS = ['forecast', 'overdue', 'partial', 'paid', 'cancelled'];

    public static function situationSql(string $today): string
    {
        return "CASE WHEN finance_installments.status = 'cancelled' OR finance_entries.status = 'cancelled' THEN 'cancelled'
            WHEN finance_installments.status = 'paid' THEN 'paid'
            WHEN finance_installments.due_date < '{$today}' THEN 'overdue'
            WHEN finance_installments.paid_cents > 0 THEN 'partial'
            ELSE 'forecast' END";
    }

    /**
     * @param  array<string, mixed>  $f
     * @return Builder<FinanceInstallment>
     */
    public function installments(Organization $organization, array $f): Builder
    {
        $today = CarbonImmutable::now($organization->timezone ?: config('autoescola.default_timezone'))->toDateString();
        $dateColumn = ($f['date_field'] ?? 'due') === 'paid' ? 'finance_installments.paid_on' : 'finance_installments.due_date';

        $query = FinanceInstallment::query()
            ->join('finance_entries', 'finance_entries.id', '=', 'finance_installments.entry_id')
            ->where('finance_installments.organization_id', $organization->getKey())
            ->select('finance_installments.*')
            ->selectRaw(self::situationSql($today).' as situation')
            ->when($f['type'] ?? null, fn ($q, $v) => $q->where('finance_entries.type', $v))
            ->when($f['from'] ?? null, fn ($q, $v) => $q->whereDate($dateColumn, '>=', $v))
            ->when($f['to'] ?? null, fn ($q, $v) => $q->whereDate($dateColumn, '<=', $v))
            ->when($f['student_id'] ?? null, fn ($q, $v) => $q->where('finance_entries.student_id', $v))
            ->when($f['partner_id'] ?? null, fn ($q, $v) => $q->where('finance_entries.partner_id', $v))
            ->when($f['party_id'] ?? null, fn ($q, $v) => $q->where('finance_entries.party_id', $v))
            ->when($f['category_id'] ?? null, fn ($q, $v) => $q->where('finance_entries.category_id', $v))
            ->when($f['enrollment_id'] ?? null, fn ($q, $v) => $q->where('finance_entries.enrollment_id', $v))
            ->when($f['vehicle_id'] ?? null, fn ($q, $v) => $q->where('finance_entries.vehicle_id', $v))
            ->when($f['entry_id'] ?? null, fn ($q, $v) => $q->where('finance_entries.id', $v))
            ->when($f['method_id'] ?? null, fn ($q, $v) => $q->whereExists(fn ($e) => $e->selectRaw('1')->from('finance_payments')
                ->whereColumn('finance_payments.installment_id', 'finance_installments.id')->where('finance_payments.status', '!=', 'reversed')->where('finance_payments.method_id', $v)))
            ->when($f['account_id'] ?? null, fn ($q, $v) => $q->whereExists(fn ($e) => $e->selectRaw('1')->from('finance_payments')
                ->whereColumn('finance_payments.installment_id', 'finance_installments.id')->where('finance_payments.status', '!=', 'reversed')->where('finance_payments.account_id', $v)))
            ->when($f['q'] ?? null, function ($q, $v) {
                $term = '%'.$v.'%';
                $q->where(fn ($w) => $w->where('finance_entries.description', 'like', $term)
                    ->orWhereExists(fn ($s) => $s->selectRaw('1')->from('students')->whereColumn('students.id', 'finance_entries.student_id')->where('students.name', 'like', $term))
                    ->orWhereExists(fn ($s) => $s->selectRaw('1')->from('partners')->whereColumn('partners.id', 'finance_entries.partner_id')->where('partners.name', 'like', $term))
                    ->orWhereExists(fn ($s) => $s->selectRaw('1')->from('finance_parties')->whereColumn('finance_parties.id', 'finance_entries.party_id')->where('finance_parties.name', 'like', $term)));
            });

        if (! empty($f['situation'])) {
            $situations = array_values(array_intersect(explode(',', (string) $f['situation']), self::SITUATIONS));
            if ($situations !== []) {
                $query->whereRaw('('.self::situationSql($today).') IN ('.implode(',', array_fill(0, count($situations), '?')).')', $situations);
            }
        }

        return $query;
    }

    /**
     * @param  array<string, mixed>  $f
     * @return array{count: int, amount_cents: int, outstanding_cents: int, by_situation: array<string, array{count: int, amount_cents: int, outstanding_cents: int}>}
     */
    public function totals(Organization $organization, array $f): array
    {
        $today = CarbonImmutable::now($organization->timezone ?: config('autoescola.default_timezone'))->toDateString();
        $situationFilterless = $f;
        unset($situationFilterless['situation']);

        $rows = $this->installments($organization, $situationFilterless)->toBase()->reorder()
            ->select([])
            ->selectRaw(self::situationSql($today).' as situation, COUNT(*) as n, COALESCE(SUM(finance_installments.amount_cents),0) as amount, COALESCE(SUM(CASE WHEN finance_installments.status = \'cancelled\' OR finance_entries.status = \'cancelled\' THEN 0 ELSE finance_installments.amount_cents - finance_installments.paid_cents END),0) as outstanding')
            ->groupBy('situation')->get();

        $by = [];
        foreach (self::SITUATIONS as $s) {
            $by[$s] = ['count' => 0, 'amount_cents' => 0, 'outstanding_cents' => 0];
        }
        foreach ($rows as $row) {
            $by[$row->situation] = ['count' => (int) $row->n, 'amount_cents' => (int) $row->amount, 'outstanding_cents' => (int) $row->outstanding];
        }

        $selected = ! empty($f['situation']) ? array_intersect(explode(',', (string) $f['situation']), self::SITUATIONS) : self::SITUATIONS;
        $picked = array_intersect_key($by, array_flip($selected));

        return [
            'count' => array_sum(array_column($picked, 'count')),
            'amount_cents' => array_sum(array_column($picked, 'amount_cents')),
            'outstanding_cents' => array_sum(array_column($picked, 'outstanding_cents')),
            'by_situation' => $by,
        ];
    }
}
