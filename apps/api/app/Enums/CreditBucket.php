<?php

namespace App\Enums;

/**
 * Coluna do saldo afetada por um movimento: contratado, reservado em aula agendada ou consumido.
 */
enum CreditBucket: string
{
    case Credit = 'credit';
    case Reserve = 'reserve';
    case Consume = 'consume';
}
