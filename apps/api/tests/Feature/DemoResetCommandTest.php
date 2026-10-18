<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\InstrutorDemoSeeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\Feature\Api\ApiTestCase;

class DemoResetCommandTest extends ApiTestCase
{
    private function databaseName(): string
    {
        return (string) config('database.connections.'.config('database.default').'.database');
    }

    public function test_recusa_sem_confirmacao_do_nome_do_banco(): void
    {
        $this->artisan('demo:reset')->assertExitCode(1);
        $this->artisan('demo:reset', ['--confirm' => 'outro-banco'])->assertExitCode(1);

        $this->assertDatabaseMissing('users', ['email' => InstrutorDemoSeeder::EMAIL]);
    }

    public function test_recria_a_demonstracao_com_confirmacao(): void
    {
        $this->artisan('demo:reset', ['--confirm' => $this->databaseName()])->assertExitCode(0);
        $this->assertDatabaseHas('users', ['email' => InstrutorDemoSeeder::EMAIL]);

        // Rodar de novo apaga e recria: continua existindo uma única conta de demonstração
        $this->artisan('demo:reset', ['--confirm' => $this->databaseName()])->assertExitCode(0);
        $this->assertSame(1, User::query()->where('email', InstrutorDemoSeeder::EMAIL)->count());
        $this->assertSame(1, DB::table('demo_datasets')->where('key', 'instrutor')->count());
    }

    public function test_recusa_em_producao_sem_liberacao(): void
    {
        $this->app['env'] = 'production';
        config(['autoescola.demo_reset_allowed' => false]);

        $this->artisan('demo:reset', ['--confirm' => $this->databaseName()])->assertExitCode(1);
        $this->assertDatabaseMissing('users', ['email' => InstrutorDemoSeeder::EMAIL]);
    }

    public function test_producao_exige_senha_propria_para_a_demonstracao(): void
    {
        $this->app['env'] = 'production';
        config(['autoescola.demo_reset_allowed' => true, 'autoescola.demo_seed_password' => null]);

        $this->expectException(RuntimeException::class);
        $this->app->make(InstrutorDemoSeeder::class)->run();
    }
}
