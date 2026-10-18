<?php

namespace App\Enums;

enum IssuanceStatus: string
{
    case NotStarted = 'not_started';
    case Pending = 'pending';
    case Issued = 'issued';
    case Delivered = 'delivered';
}
