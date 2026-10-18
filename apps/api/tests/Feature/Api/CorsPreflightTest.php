<?php

namespace Tests\Feature\Api;

use Tests\TestCase;

class CorsPreflightTest extends TestCase
{
    public function test_preflight_allows_idempotency_key_header_from_spa(): void
    {
        $response = $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Access-Control-Request-Method' => 'POST',
            'Access-Control-Request-Headers' => 'content-type,idempotency-key',
        ])->options('/api/v1/organizations/1/alerts/refresh');

        $response->assertSuccessful();
        $this->assertStringContainsStringIgnoringCase(
            'idempotency-key',
            (string) $response->headers->get('Access-Control-Allow-Headers'),
        );
    }
}
