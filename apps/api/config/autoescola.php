<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Frontend URL
    |--------------------------------------------------------------------------
    |
    | Base usada nos links enviados por e-mail (aceite de convite). O token do
    | convite vai na URL apontando para o frontend, que o envia de volta ao
    | endpoint POST /api/v1/invitations/accept.
    |
    */

    'frontend_url' => env('FRONTEND_URL', 'http://localhost:5173'),

    /*
    |--------------------------------------------------------------------------
    | Validade dos convites
    |--------------------------------------------------------------------------
    |
    | Quantidade de dias até o convite expirar.
    |
    */

    'invitation_ttl_days' => (int) env('INVITATION_TTL_DAYS', 7),

    /*
    |--------------------------------------------------------------------------
    | Fuso horário padrão
    |--------------------------------------------------------------------------
    |
    | Usado quando não há espaço de referência (ex.: agenda pessoal /me/lessons)
    | e como valor inicial de novos espaços. Os horários são gravados em UTC.
    |
    */

    'default_timezone' => env('AUTOESCOLA_TIMEZONE', 'America/Sao_Paulo'),

    /*
    |--------------------------------------------------------------------------
    | Documentos
    |--------------------------------------------------------------------------
    |
    | Disco privado (nunca público) e tamanho máximo do upload, em KB.
    |
    */

    'documents_disk' => env('DOCUMENTS_DISK', 'local'),
    'document_max_kb' => (int) env('DOCUMENT_MAX_KB', 10240),

];
