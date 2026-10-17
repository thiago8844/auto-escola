<?php

namespace App\Enums;

/**
 * De onde veio a informação do item. "Conferido por funcionário" não equivale a
 * "validado pelo Detran".
 */
enum ChecklistSource: string
{
    case StudentDeclared = 'student_declared';
    case Document = 'document';
    case OfficialSystem = 'official_system';
    case Imported = 'imported';
}
