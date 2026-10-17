<?php

namespace App\Exceptions;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * Violação de regra de negócio com código estável para o cliente.
 *
 * A mensagem é voltada ao usuário final e não deve revelar dados de outras
 * organizações (ex.: "Instrutor indisponível nesse horário.").
 */
class BusinessRuleException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $errorCode,
        public readonly int $status = 422,
    ) {
        parent::__construct($message);
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'message' => $this->getMessage(),
            'error' => $this->errorCode,
        ], $this->status);
    }
}
