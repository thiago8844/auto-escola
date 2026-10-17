<?php

namespace App\Enums;

/**
 * Situação comercial da matrícula. Não substitui o processo nem o resultado de exames.
 */
enum EnrollmentStatus: string
{
    case Prospect = 'prospect';
    case Contracted = 'contracted';
    case InService = 'in_service';
    case Closed = 'closed';
    case Terminated = 'terminated';

    /**
     * Aceita novas aulas?
     */
    public function acceptsLessons(): bool
    {
        return ! in_array($this, [self::Closed, self::Terminated], true);
    }
}
