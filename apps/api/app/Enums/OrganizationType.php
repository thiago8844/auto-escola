<?php

namespace App\Enums;

enum OrganizationType: string
{
    /** Autoescola. */
    case Cfc = 'cfc';

    /** Operação particular de um instrutor. */
    case Independent = 'independent';
}
