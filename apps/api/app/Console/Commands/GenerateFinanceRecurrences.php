<?php

namespace App\Console\Commands;

use App\Models\Organization;
use App\Services\Finance\RecurrenceGenerator;
use Illuminate\Console\Command;

/** Gera os lançamentos das recorrências mensais (idempotente). Agendado todo dia. */
class GenerateFinanceRecurrences extends Command
{
    protected $signature = 'finance:recurrences {--organization= : ID de um espaço}';

    protected $description = 'Gera os lançamentos das recorrências financeiras mensais';

    public function handle(RecurrenceGenerator $generator): int
    {
        $total = 0;

        Organization::query()->when($this->option('organization'), fn ($q, $id) => $q->whereKey($id))->chunkById(100, function ($organizations) use ($generator, &$total) {
            foreach ($organizations as $organization) {
                $total += $generator->run($organization);
            }
        });

        $this->info("{$total} lançamento(s) criado(s).");

        return self::SUCCESS;
    }
}
