<?php

namespace App\Enums;

enum FeeStatus: string
{
    case Unknown = 'unknown';
    case Pending = 'pending';
    case PaymentReported = 'payment_reported';
    case Confirmed = 'confirmed';
    case Waived = 'waived';
    case Cancelled = 'cancelled';

    /** Taxa que ainda exige ação da equipe. */
    public function isOpen(): bool
    {
        return in_array($this, [self::Unknown, self::Pending, self::PaymentReported], true);
    }
}
