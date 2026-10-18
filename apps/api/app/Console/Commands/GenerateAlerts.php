<?php

namespace App\Console\Commands;

use App\Jobs\GenerateOrganizationAlerts;
use App\Models\Organization;
use App\Services\AlertEngine;
use Illuminate\Console\Command;

/**
 * Rotina periódica (agendador) e de reprocessamento das pendências.
 *
 *   php artisan alerts:generate                 # enfileira um trabalho por espaço
 *   php artisan alerts:generate --now           # executa na hora, sem fila
 *   php artisan alerts:generate --organization=3 --now   # reprocessa um espaço
 */
class GenerateAlerts extends Command
{
    protected $signature = 'alerts:generate {--organization= : ID de um espaço} {--now : Executa sem passar pela fila}';

    protected $description = 'Gera, atualiza e resolve as pendências (alertas) dos espaços';

    public function handle(AlertEngine $engine): int
    {
        $query = Organization::query()->when($this->option('organization'), fn ($q, $id) => $q->whereKey($id));
        $total = 0;

        $query->chunkById(100, function ($organizations) use ($engine, &$total) {
            foreach ($organizations as $organization) {
                $total++;

                if ($this->option('now')) {
                    $result = $engine->run($organization);
                    $this->line("#{$organization->getKey()} {$organization->name}: {$result['created']} novas, {$result['updated']} atualizadas, {$result['resolved']} resolvidas.");
                } else {
                    GenerateOrganizationAlerts::dispatch($organization->getKey());
                }
            }
        });

        $this->info($this->option('now') ? "{$total} espaço(s) processado(s)." : "{$total} trabalho(s) enfileirado(s).");

        return self::SUCCESS;
    }
}
