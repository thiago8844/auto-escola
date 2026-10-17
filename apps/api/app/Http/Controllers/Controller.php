<?php

namespace App\Http\Controllers;

use App\Enums\MembershipRole;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;

abstract class Controller extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    /**
     * Itens por página, limitados a 100.
     */
    protected function perPage(Request $request): int
    {
        return min(100, max(1, $request->integer('per_page', 15)));
    }

    /**
     * Papel do usuário no espaço da rota (definido por EnsureOrganizationMember).
     */
    protected function organizationRole(Request $request): ?MembershipRole
    {
        return $request->attributes->get('organization_role');
    }

    /**
     * Equipe de operação (owner, admin, staff) enxerga o espaço inteiro.
     * Os demais papéis (instrutor) veem apenas o que está atribuído a eles.
     */
    protected function isOperator(Request $request): bool
    {
        return $this->organizationRole($request)?->canOperate() ?? false;
    }
}
