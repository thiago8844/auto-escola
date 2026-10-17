<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * Os testes criam e apagam tabelas (RefreshDatabase). Recusamos qualquer banco
     * cujo nome não termine em "_test" para nunca tocar em dados de desenvolvimento.
     */
    protected function setUp(): void
    {
        $database = $_ENV['DB_DATABASE'] ?? getenv('DB_DATABASE') ?: '';

        if (! str_ends_with($database, '_test')) {
            throw new RuntimeException(
                "Testes recusados: DB_DATABASE='{$database}' não termina em '_test'. Use o banco autoescola_test.",
            );
        }

        parent::setUp();
    }
}
