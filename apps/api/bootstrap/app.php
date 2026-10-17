<?php

use App\Http\Middleware\EnsureOrganizationMember;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // SPA: autentica por cookie de sessão do Sanctum nos domínios em SANCTUM_STATEFUL_DOMAINS.
        $middleware->statefulApi();

        $middleware->alias([
            'organization.member' => EnsureOrganizationMember::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Respostas da API em português e sem nomes internos de classes.
        // O Laravel converte AuthorizationException em AccessDeniedHttpException antes dos
        // renderers, então o tratamento cobre a classe convertida (e a original, por segurança).
        $exceptions->render(function (Throwable $e, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            return match (true) {
                $e instanceof AuthenticationException => response()->json([
                    'message' => 'Não autenticado.',
                    'error' => 'unauthenticated',
                ], 401),
                $e instanceof AuthorizationException, $e instanceof AccessDeniedHttpException => response()->json([
                    'message' => 'Você não tem permissão para realizar esta ação.',
                    'error' => 'forbidden',
                ], 403),
                $e instanceof ModelNotFoundException => response()->json([
                    'message' => 'Registro não encontrado.',
                    'error' => 'not_found',
                ], 404),
                default => null,
            };
        });
    })->create();
