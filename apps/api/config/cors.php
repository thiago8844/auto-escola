<?php

return [

    /*
    |--------------------------------------------------------------------------
    | CORS para a SPA
    |--------------------------------------------------------------------------
    |
    | A SPA roda em outra origem (ex.: http://localhost:5173) e usa cookie de
    | sessão do Sanctum. Por isso supports_credentials é true: o navegador só envia
    | o cookie em requisições cross-origin quando a resposta permite credenciais,
    | e nesse caso a origem precisa estar explicitamente listada (nunca "*").
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => array_filter(explode(',', (string) env('CORS_ALLOWED_ORIGINS', 'http://localhost:5173'))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Accept', 'Authorization', 'Content-Type', 'X-Requested-With', 'X-XSRF-TOKEN'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
