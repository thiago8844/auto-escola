<?php

namespace App\Enums;

/**
 * Situação do acompanhamento local do processo (não é o status oficial do Detran).
 */
enum ProcessStatus: string
{
    case Preparing = 'preparing';
    case Active = 'active';
    case Pending = 'pending';
    case AwaitingIssuance = 'awaiting_issuance';
    case Completed = 'completed';
    case Closed = 'closed';
}
