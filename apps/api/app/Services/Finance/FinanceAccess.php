<?php

namespace App\Services\Finance;

use App\Enums\MembershipRole;
use App\Models\Organization;
use App\Models\User;

/**
 * Permissões do financeiro (decisão de produto, ver docs/permissoes.md):
 *
 * | Ação                                                    | owner | admin | staff | instructor |
 * | Ver, lançar, editar parcelas abertas, dar baixa         |  sim  |  sim  |  sim  |    não     |
 * | Contas, categorias, formas, favorecidos, recorrências   |  sim  |  sim  |  não  |    não     |
 * | Estornar, cancelar, transferir, ajustar saldo, conciliar|  sim  |  sim  |  não  |    não     |
 *
 * O instrutor nunca acessa o caixa do espaço. Ser dono do espaço particular dá ao autônomo acesso total à própria operação.
 */
class FinanceAccess
{
    public function role(User $user, Organization $organization): ?MembershipRole
    {
        return $organization->roleFor($user);
    }

    /** Ver, lançar e dar baixa. */
    public function operate(User $user, Organization $organization): bool
    {
        return $this->role($user, $organization)?->canOperate() ?? false;
    }

    /** Cadastros, estornos, cancelamentos, transferências, ajustes e conciliação. */
    public function manage(User $user, Organization $organization): bool
    {
        return in_array($this->role($user, $organization), [MembershipRole::Owner, MembershipRole::Admin], true);
    }
}
