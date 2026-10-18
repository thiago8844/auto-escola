<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * Proteção contra duplo envio e reenvio após falha de rede.
 *
 * Quando o cliente manda `Idempotency-Key`, a primeira resposta bem-sucedida (2xx) é guardada por 24 horas e
 * devolvida, sem executar de novo, para qualquer repetição da mesma chave. Duas requisições simultâneas com a
 * mesma chave não rodam juntas: a segunda recebe 409. Reusar a chave com outro conteúdo é recusado.
 */
class IdempotentRequests
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->header('Idempotency-Key');

        if ($key === null || ! in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE'], true)
            || $request->user() === null || ! preg_match('/^[A-Za-z0-9._:-]{8,100}$/', $key)) {
            return $next($request);
        }

        $cacheKey = 'idem:'.$request->user()->getKey().':'.sha1($request->method().'|'.$request->path().'|'.$key);
        $fingerprint = $this->fingerprint($request);

        if (($stored = Cache::get($cacheKey)) !== null) {
            if ($stored['fingerprint'] !== $fingerprint) {
                return new JsonResponse([
                    'message' => 'Esta solicitação já foi enviada com outro conteúdo. Recarregue a tela e tente de novo.',
                    'error' => 'idempotency_key_reused',
                ], 422);
            }

            return (new JsonResponse($stored['body'], $stored['status'], ['Idempotent-Replay' => 'true']))
                ->setStatusCode($stored['status']);
        }

        $lock = Cache::lock($cacheKey.':lock', 20);

        if (! $lock->get()) {
            return new JsonResponse([
                'message' => 'Esta ação já está sendo processada. Aguarde um instante.',
                'error' => 'request_in_progress',
            ], 409);
        }

        try {
            $response = $next($request);

            if ($response->isSuccessful() && $response instanceof JsonResponse) {
                Cache::put($cacheKey, [
                    'fingerprint' => $fingerprint,
                    'status' => $response->getStatusCode(),
                    'body' => $response->getData(true),
                ], now()->addHours(24));
            }

            return $response;
        } finally {
            $lock->release();
        }
    }

    private function fingerprint(Request $request): string
    {
        $files = collect($request->allFiles())->flatten()->map(fn ($f) => $f->getClientOriginalName().':'.$f->getSize())->all();

        return sha1(json_encode([$request->except(array_keys($request->allFiles())), $files]));
    }
}
