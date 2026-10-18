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

    /*
    |--------------------------------------------------------------------------
    | Política de senha
    |--------------------------------------------------------------------------
    |
    | Decisão de produto (módulo 6): em produção a senha tem no mínimo 8 caracteres; em desenvolvimento e testes
    | o mínimo continua 3 para facilitar o trabalho. Sobrescreva com AUTOESCOLA_PASSWORD_MIN. Não há exigência de
    | símbolos, para não dificultar o uso; o web mostra o mínimo vigente.
    |
    */

    'password_min' => (int) env('AUTOESCOLA_PASSWORD_MIN', env('APP_ENV') === 'production' ? 8 : 3),

    /*
    |--------------------------------------------------------------------------
    | Suporte
    |--------------------------------------------------------------------------
    |
    | Canal exibido no web (primeiro acesso e rodapé). Preencha antes de publicar.
    |
    */

    'support_email' => env('AUTOESCOLA_SUPPORT_EMAIL'),

    'documents_disk' => env('DOCUMENTS_DISK', 'local'),
    'document_max_kb' => (int) env('DOCUMENT_MAX_KB', 10240),

];
