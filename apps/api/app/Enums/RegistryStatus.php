<?php

namespace App\Enums;

/**
 * Situação do registro oficial da aula (ex.: lançamento no sistema do órgão),
 * separada do status operacional da aula. Preenchida manualmente, com evidência.
 */
enum RegistryStatus: string
{
    case NotInformed = 'not_informed';
    case Pending = 'pending';
    case Confirmed = 'confirmed';
    case Rejected = 'rejected';
}
