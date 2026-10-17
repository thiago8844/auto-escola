<?php

namespace App\Enums;

/**
 * Situação do documento. `verified` é conferência interna; não prova autenticidade.
 */
enum DocumentStatus: string
{
    case Attached = 'attached';
    case Verified = 'verified';
    case Rejected = 'rejected';
    case Replaced = 'replaced';
}
