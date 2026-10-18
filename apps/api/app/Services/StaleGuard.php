<?php

namespace App\Services;

use App\Exceptions\BusinessRuleException;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;

/**
 * Edição simultânea: se o cliente informa `expected_updated_at` (o `updated_at` que ele carregou) e o registro
 * mudou desde então, a gravação é recusada em vez de sobrescrever em silêncio a alteração de outra pessoa.
 * Sem o campo, o comportamento é o de sempre (compatível com clientes antigos e com o app mobile).
 */
class StaleGuard
{
    public function assertFresh(Model $model, Request $request): void
    {
        $expected = $request->input('expected_updated_at');

        if ($expected === null || $model->updated_at === null) {
            return;
        }

        $loaded = \Carbon\CarbonImmutable::parse($expected);

        if ($model->updated_at->getTimestamp() !== $loaded->getTimestamp()) {
            throw new BusinessRuleException(
                'Este registro foi alterado por outra pessoa depois que você abriu a tela. Recarregue para ver a versão atual e refaça a alteração.',
                'stale_record',
                409,
            );
        }
    }
}
