<?php

namespace App\Enums;

/**
 * Situação de uma tentativa de exame prático. Ausência não é reprovação; "não concluído"
 * é o exame iniciado e não finalizado. Somente "agendado" aceita resultado ou cancelamento.
 */
enum ExamStatus: string
{
    case Scheduled = 'scheduled';
    case Cancelled = 'cancelled';
    case Approved = 'approved';
    case Failed = 'failed';
    case Absent = 'absent';
    case Incomplete = 'incomplete';

    public function isResult(): bool
    {
        return in_array($this, [self::Approved, self::Failed, self::Absent, self::Incomplete], true);
    }

    /** @return list<self> */
    public function allowedTransitions(): array
    {
        return $this === self::Scheduled
            ? [self::Cancelled, self::Approved, self::Failed, self::Absent, self::Incomplete]
            : [];
    }
}
