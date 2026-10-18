<?php

namespace Tests\Feature;

use App\Models\EnrollmentPackage;
use App\Models\Organization;
use App\Models\User;
use App\Services\CreditLedger;
use Carbon\CarbonImmutable;
use Database\Seeders\DemoDataset;
use Database\Seeders\InstrutorDemoSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use Tests\Feature\Api\ApiTestCase;

class InstrutorDemoSeederTest extends ApiTestCase
{
    public function test_creates_coherent_instructor_demo_and_login(): void
    {
        Storage::fake(config('autoescola.documents_disk'));
        $this->seed(InstrutorDemoSeeder::class);

        $user = User::query()->where('email', InstrutorDemoSeeder::EMAIL)->firstOrFail();
        $organizationId = DB::table('demo_datasets')->where('key', 'instrutor')->value('organization_id');
        $this->assertTrue(Hash::check(InstrutorDemoSeeder::PASSWORD, $user->password));
        $this->postJson($this->prefix.'/auth/token', [
            'email' => InstrutorDemoSeeder::EMAIL, 'password' => InstrutorDemoSeeder::PASSWORD, 'device_name' => 'teste',
        ])->assertCreated()->assertJsonPath('user.email', InstrutorDemoSeeder::EMAIL);
        $this->assertSame(48, DB::table('students')->where('organization_id', $organizationId)->count());
        // 8 aulas por dia útil (seg a sáb) de 45 dias de histórico a 30 de agenda, mais 2 do aluno com pacote pequeno
        $timezone = config('autoescola.default_timezone');
        $today = CarbonImmutable::now($timezone)->startOfDay();
        $workdays = collect(range(-45, 30))->filter(fn (int $offset) => $today->addDays($offset)->isoWeekday() !== 7)->count();
        $this->assertSame(8 * $workdays + 2, DB::table('lessons')->where('organization_id', $organizationId)->count());
        $this->assertSame(40, DB::table('enrollment_packages')->where('organization_id', $organizationId)->count());
        $this->assertSame(40, DB::table('finance_entries')->where('organization_id', $organizationId)->where('type', 'receivable')->count());
        $this->assertSame(29, DB::table('finance_payments')->where('organization_id', $organizationId)->where('status', 'confirmed')->count());
        $this->assertSame(29, DB::table('finance_movements')->where('organization_id', $organizationId)->count());
        $this->assertSame(5, DB::table('documents')->where('organization_id', $organizationId)->count());
        $this->assertGreaterThan(0, DB::table('alerts')->where('organization_id', $organizationId)->count());

        $overlap = DB::table('lessons as a')->join('lessons as b', function ($join) {
            $join->on('a.instructor_id', '=', 'b.instructor_id')->whereColumn('a.id', '<', 'b.id')
                ->whereColumn('a.starts_at', '<', 'b.ends_at')->whereColumn('a.ends_at', '>', 'b.starts_at');
        })->where('a.organization_id', $organizationId)->count();
        $this->assertSame(0, $overlap);
        $this->assertSame(0, DB::table('lessons')->where('organization_id', $organizationId)->where('starts_at', '>', now()->utc())->where('status', '!=', 'scheduled')->count());
        $this->assertSame(0, DB::table('finance_installments')->where('organization_id', $organizationId)->whereColumn('paid_cents', '>', 'amount_cents')->count());

        $smallPackage = EnrollmentPackage::query()->where('organization_id', $organizationId)->where('minutes', 180)->firstOrFail();
        $this->assertSame(60, app(CreditLedger::class)->balanceFor($smallPackage->enrollment)['available']);

        $firstPath = DB::table('documents')->where('organization_id', $organizationId)->value('storage_path');
        Storage::disk(config('autoescola.documents_disk'))->assertExists($firstPath);
    }

    public function test_reexecution_replaces_only_owned_data(): void
    {
        Storage::fake(config('autoescola.documents_disk'));
        $outsider = User::factory()->create();
        $other = Organization::factory()->create();
        $other->members()->attach($outsider->getKey(), ['role' => 'owner']);
        DB::table('demo_datasets')->insert([
            'key' => 'cfc', 'organization_id' => $other->getKey(), 'user_id' => $outsider->getKey(),
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $this->seed(InstrutorDemoSeeder::class);
        $firstUserId = DB::table('demo_datasets')->where('key', 'instrutor')->value('user_id');
        $firstOrgId = DB::table('demo_datasets')->where('key', 'instrutor')->value('organization_id');
        $firstPath = DB::table('documents')->where('organization_id', $firstOrgId)->value('storage_path');
        $this->seed(InstrutorDemoSeeder::class);

        $this->assertDatabaseCount('demo_datasets', 2);
        $this->assertDatabaseHas('demo_datasets', ['key' => 'cfc', 'organization_id' => $other->getKey()]);
        $this->assertDatabaseCount('organizations', 2);
        $this->assertDatabaseCount('students', 48);
        $this->assertDatabaseMissing('users', ['id' => $firstUserId]);
        $this->assertDatabaseHas('users', ['id' => $outsider->getKey()]);
        $this->assertDatabaseHas('organizations', ['id' => $other->getKey()]);
        Storage::disk(config('autoescola.documents_disk'))->assertMissing($firstPath);
    }

    public function test_email_collision_aborts_without_deleting_existing_data(): void
    {
        User::factory()->create(['email' => InstrutorDemoSeeder::EMAIL]);
        $this->expectException(RuntimeException::class);
        $this->seed(InstrutorDemoSeeder::class);
    }

    public function test_external_instructor_link_blocks_cleanup_and_preserves_dataset(): void
    {
        Storage::fake(config('autoescola.documents_disk'));
        $this->seed(InstrutorDemoSeeder::class);
        $user = User::query()->where('email', InstrutorDemoSeeder::EMAIL)->firstOrFail();
        $other = Organization::factory()->create();
        $other->instructors()->attach($user->instructor->getKey(), ['active' => true]);

        try {
            $this->seed(InstrutorDemoSeeder::class);
            $this->fail('A limpeza deveria recusar o vínculo externo.');
        } catch (RuntimeException $exception) {
            $this->assertStringContainsString('vínculo externo', $exception->getMessage());
        }

        $this->assertDatabaseHas('users', ['id' => $user->getKey()]);
        $this->assertDatabaseCount('students', 48);
        $this->assertDatabaseHas('demo_datasets', ['key' => 'instrutor', 'user_id' => $user->getKey()]);
    }

    public function test_refuses_non_demo_environment(): void
    {
        $this->app['env'] = 'production';
        $this->expectException(RuntimeException::class);
        $this->app->make(InstrutorDemoSeeder::class)->run();
    }

    public function test_shared_dataset_cleans_registered_additional_accounts(): void
    {
        $dataset = app(DemoDataset::class);
        $build = function (): array {
            $owner = User::factory()->create(['email' => 'owner@example.test']);
            $staff = User::factory()->create(['email' => 'staff@example.test']);
            $organization = Organization::factory()->create();
            $organization->members()->attach($owner->getKey(), ['role' => 'owner']);
            $organization->members()->attach($staff->getKey(), ['role' => 'staff']);

            return [$owner, $organization, [$staff]];
        };

        $dataset->rebuildDemoDataset('shared-test', 'owner@example.test', $build);
        $oldUserIds = DB::table('demo_dataset_users')->where('dataset_key', 'shared-test')->pluck('user_id')->all();
        $dataset->rebuildDemoDataset('shared-test', 'owner@example.test', $build);

        $this->assertSame(2, DB::table('demo_dataset_users')->where('dataset_key', 'shared-test')->count());
        $this->assertSame(0, DB::table('users')->whereIn('id', $oldUserIds)->count());
        $this->assertDatabaseCount('organizations', 1);
    }
}
