<?php

namespace App\Jobs;

use App\Models\Organization;
use App\Services\AlertEngine;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Recalcula as pendências de um espaço. Idempotente: pode rodar repetido sem duplicar alertas.
 */
class GenerateOrganizationAlerts implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public readonly int $organizationId) {}

    public function handle(AlertEngine $engine): void
    {
        $organization = Organization::query()->find($this->organizationId);

        if ($organization !== null) {
            $engine->run($organization);
        }
    }
}
