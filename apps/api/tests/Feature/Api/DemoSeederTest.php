<?php

namespace Tests\Feature\Api;

use App\Actions\Instructors\CreateInstructorProfile;
use App\Actions\Lessons\ScheduleLesson;
use App\Actions\Organizations\CreateOrganization;
use App\Models\User;
use Database\Seeders\DemoSeeder;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

class DemoSeederTest extends ApiTestCase
{
    public function test_demo_seeder_creates_joao_in_three_spaces_with_one_lesson_each(): void
    {
        $this->seed(DemoSeeder::class);

        $joao = User::query()->where('email', 'joao@autoescola.demo')->firstOrFail();
        $this->assertTrue(Hash::check(DemoSeeder::PASSWORD, $joao->password));

        $this->actingAsUser($joao)
            ->getJson($this->prefix.'/me/lessons')
            ->assertOk()
            ->assertJsonCount(3, 'data');

        $this->assertDatabaseCount('organizations', 3);
        $this->assertDatabaseCount('lessons', 3);
    }

    public function test_demo_seeder_is_idempotent(): void
    {
        $this->seed(DemoSeeder::class);
        $this->seed(DemoSeeder::class);

        $this->assertDatabaseCount('organizations', 3);
        $this->assertDatabaseCount('lessons', 3);
    }

    public function test_demo_seeder_refuses_production(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $this->expectException(RuntimeException::class);

        (new DemoSeeder(
            $this->app->make(CreateOrganization::class),
            $this->app->make(CreateInstructorProfile::class),
            $this->app->make(ScheduleLesson::class),
        ))->run();
    }
}
