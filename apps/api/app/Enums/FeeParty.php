<?php

namespace App\Enums;

/**
 * Pessoa/entidade ligada a uma taxa externa (obrigado a pagar ou quem pagou de fato).
 */
enum FeeParty: string
{
    case Student = 'student';
    case Partner = 'partner';
    case Organization = 'organization';
    case Other = 'other';
}
