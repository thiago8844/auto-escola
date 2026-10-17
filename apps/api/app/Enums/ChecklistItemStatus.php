<?php

namespace App\Enums;

/**
 * Situação de um item do checklist. Só `verified` (conferido por funcionário) e
 * `not_applicable` (com motivo) liberam a prática; `done` é o que foi declarado/realizado,
 * ainda sem conferência.
 */
enum ChecklistItemStatus: string
{
    case Unknown = 'unknown';
    case Pending = 'pending';
    case InProgress = 'in_progress';
    case Done = 'done';
    case Verified = 'verified';
    case NotApplicable = 'not_applicable';
    case Blocked = 'blocked';

    public function clearsPractice(): bool
    {
        return in_array($this, [self::Verified, self::NotApplicable], true);
    }

    /**
     * Estados que exigem uma justificativa registrada.
     */
    public function requiresReason(): bool
    {
        return in_array($this, [self::NotApplicable, self::Blocked], true);
    }
}
