<?php

namespace App\Enums;

enum ClosureKind: string
{
    case Completed = 'completed';
    case Abandoned = 'abandoned';
    case Other = 'other';
}
