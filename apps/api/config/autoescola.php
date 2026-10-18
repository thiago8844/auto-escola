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
    | Mínimo de 3 caracteres em todos os ambientes, para facilitar o uso. Sobrescreva com AUTOESCOLA_PASSWORD_MIN. Não há exigência de
    | símbolos, para não dificultar o uso; o web mostra o mínimo vigente.
    |
    */

    'password_min' => (int) env('AUTOESCOLA_PASSWORD_MIN', 3),

    /*
    |--------------------------------------------------------------------------
    | Suporte
    |--------------------------------------------------------------------------
    |
    | Canal exibido no web (primeiro acesso e rodapé). Preencha antes de publicar.
    |
    */

    'support_email' => env('AUTOESCOLA_SUPPORT_EMAIL'),

    /*
    |--------------------------------------------------------------------------
    | Demonstração em produção
    |--------------------------------------------------------------------------
    |
    | Liga o `demo:reset` (apaga e recria a demonstração) fora de local/testing.
    | Deixe false no dia a dia e ligue só na hora de rodar o reset. A senha das
    | contas de demonstração em produção vem de DEMO_SEED_PASSWORD (mín. 8 caracteres).
    |
    */

    'demo_reset_allowed' => (bool) env('DEMO_RESET_ALLOWED', false),
    'demo_seed_password' => env('DEMO_SEED_PASSWORD'),

    'documents_disk' => env('DOCUMENTS_DISK', 'local'),
    'document_max_kb' => (int) env('DOCUMENT_MAX_KB', 10240),

];
