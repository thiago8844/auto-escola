<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\Finance\FinanceAccess;
use App\Services\Finance\FinanceDefaults;
use Illuminate\Http\Request;

/**
 * Base dos controllers do financeiro: permissões por operação (ver FinanceAccess) e cadastros iniciais.
 */
abstract class FinanceController extends Controller
{
    public function __construct(protected readonly FinanceAccess $access, protected readonly FinanceDefaults $defaults) {}

    /** Ver, lançar e dar baixa: proprietário, gestor e equipe. Instrutor nunca. */
    protected function operate(Request $request, Organization $organization): void
    {
        abort_unless($this->access->operate($request->user(), $organization), 403, 'O financeiro é da equipe do espaço.');
    }

    /** Cadastros, estornos, cancelamentos, transferências, ajustes e conciliação: proprietário e gestor. */
    protected function manage(Request $request, Organization $organization): void
    {
        abort_unless($this->access->manage($request->user(), $organization), 403, 'Esta ação do financeiro é de proprietários e gestores.');
    }
}
