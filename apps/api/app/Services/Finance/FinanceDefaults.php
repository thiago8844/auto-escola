<?php

namespace App\Services\Finance;

use App\Models\FinanceCategory;
use App\Models\FinancePaymentMethod;
use App\Models\Organization;

/**
 * Cadastros iniciais simples, criados na primeira consulta do financeiro: categorias de receita e despesa e as formas
 * de pagamento mais comuns. A equipe pode renomear, inativar ou acrescentar.
 */
class FinanceDefaults
{
    public const CATEGORY_TUITION = 'Aulas e contratação';

    public const CATEGORY_REIMBURSEMENT = 'Reembolso de taxas';

    public const CATEGORY_FEE_ADVANCE = 'Taxas externas adiantadas';

    public const CATEGORY_MAINTENANCE = 'Manutenção de veículos';

    public function ensure(Organization $organization): void
    {
        $id = $organization->getKey();

        if (! FinanceCategory::query()->where('organization_id', $id)->exists()) {
            foreach ([
                ['income', self::CATEGORY_TUITION, false],
                ['income', 'Serviços avulsos', false],
                ['income', self::CATEGORY_REIMBURSEMENT, true],
                ['income', 'Outras receitas', false],
                ['expense', self::CATEGORY_MAINTENANCE, false],
                ['expense', 'Combustível', false],
                ['expense', 'Aluguel e contas', false],
                ['expense', 'Salários e comissões', false],
                ['expense', self::CATEGORY_FEE_ADVANCE, true],
                ['expense', 'Outras despesas', false],
            ] as [$type, $name, $pass]) {
                FinanceCategory::create(['organization_id' => $id, 'type' => $type, 'name' => $name, 'is_pass_through' => $pass]);
            }
        }

        if (! FinancePaymentMethod::query()->where('organization_id', $id)->exists()) {
            foreach ([
                ['Dinheiro', 'cash', 0], ['Pix', 'pix', 0], ['Transferência bancária', 'transfer', 0],
                ['Cartão de débito', 'debit', 1], ['Cartão de crédito', 'credit', 30], ['Boleto', 'boleto', 2], ['Outra forma', 'other', 0],
            ] as [$name, $kind, $days]) {
                FinancePaymentMethod::create(['organization_id' => $id, 'name' => $name, 'kind' => $kind, 'settlement_days' => $days]);
            }
        }
    }

    public function category(Organization $organization, string $type, string $name, bool $passThrough): FinanceCategory
    {
        $this->ensure($organization);

        return FinanceCategory::query()->firstOrCreate(
            ['organization_id' => $organization->getKey(), 'type' => $type, 'name' => $name],
            ['is_pass_through' => $passThrough],
        );
    }
}
