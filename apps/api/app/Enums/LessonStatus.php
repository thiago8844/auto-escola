<?php

namespace App\Enums;

/**
 * Status de uma aula. Apenas aulas agendadas podem mudar de status ou ser remarcadas.
 */
enum LessonStatus: string
{
    case Scheduled = 'scheduled';
    case Completed = 'completed';
    case Missed = 'missed';
    case Cancelled = 'cancelled';

    /**
     * Transições permitidas. Estados finais não têm saídas.
     *
     * @return list<self>
     */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Scheduled => [self::Completed, self::Missed, self::Cancelled],
            self::Completed, self::Missed, self::Cancelled => [],
        };
    }

    public function canTransitionTo(self $next): bool
    {
        return in_array($next, $this->allowedTransitions(), true);
    }
}
