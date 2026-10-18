<?php

namespace App\Console\Commands;

use Database\Seeders\InstrutorDemoSeeder;
use Illuminate\Console\Command;

/**
 * Apaga a demonstração atual e recria os dados. Só mexe nas organizações e contas marcadas como demonstração.
 *
 *   php artisan demo:reset --confirm=<nome-do-banco>
 *
 * Fora de local/testing exige DEMO_RESET_ALLOWED=true. Faça backup do banco antes.
 */
class DemoReset extends Command
{
    protected $signature = 'demo:reset {--confirm= : Nome do banco atual, para confirmar a recriação}';

    protected $description = 'Apaga e recria a demonstração (somente dados marcados como demonstração)';

    public function handle(): int
    {
        $database = (string) config('database.connections.'.config('database.default').'.database');

        if (! app()->environment(['local', 'testing']) && ! config('autoescola.demo_reset_allowed')) {
            $this->error('Recusado: neste ambiente, defina DEMO_RESET_ALLOWED=true para liberar o reset.');

            return self::FAILURE;
        }

        if ($this->option('confirm') !== $database) {
            $this->error("Recusado: para confirmar, rode com --confirm={$database} (nome do banco atual).");

            return self::FAILURE;
        }

        $this->warn('Isto apaga a demonstração atual e recria os dados. Faça backup do banco antes em produção.');

        return $this->call('db:seed', ['--class' => InstrutorDemoSeeder::class, '--force' => true]);
    }
}
