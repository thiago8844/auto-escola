<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Pendências: recalcula todos os espaços a cada 10 minutos, sem depender de alguém abrir a tela.
// Requer `php artisan schedule:work` (ou cron com `schedule:run`) e um worker de fila (`queue:work`).
Schedule::command('alerts:generate')->everyTenMinutes()->withoutOverlapping();
