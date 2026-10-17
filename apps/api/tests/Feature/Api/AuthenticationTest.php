<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

class AuthenticationTest extends ApiTestCase
{
    private const PASSWORD = 'senha-forte-123';

    public function test_register_creates_unverified_user_and_sends_verification_email(): void
    {
        Notification::fake();

        $response = $this->postJson($this->prefix.'/auth/register', [
            'name' => 'Ana Souza',
            'email' => 'ANA@example.com',
            'password' => self::PASSWORD,
            'password_confirmation' => self::PASSWORD,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.email', 'ana@example.com')
            ->assertJsonPath('data.email_verified', false)
            ->assertJsonMissingPath('data.password');

        $user = User::query()->where('email', 'ana@example.com')->firstOrFail();
        Notification::assertSentTo($user, VerifyEmail::class);
    }

    public function test_register_rejects_duplicate_email(): void
    {
        User::factory()->create(['email' => 'dup@example.com']);

        $this->postJson($this->prefix.'/auth/register', [
            'name' => 'Outra',
            'email' => 'dup@example.com',
            'password' => self::PASSWORD,
            'password_confirmation' => self::PASSWORD,
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_spa_login_creates_session_and_rejects_wrong_password(): void
    {
        User::factory()->create(['email' => 'spa@example.com', 'password' => self::PASSWORD]);

        // Origin de domínio stateful: é isso que faz o Sanctum iniciar a sessão, como um navegador faria.
        $headers = ['Origin' => 'http://localhost'];

        $this->withHeaders($headers)
            ->postJson($this->prefix.'/auth/login', ['email' => 'spa@example.com', 'password' => 'errada-123'])
            ->assertUnauthorized()
            ->assertJsonPath('error', 'invalid_credentials');

        $this->withHeaders($headers)
            ->postJson($this->prefix.'/auth/login', ['email' => 'spa@example.com', 'password' => self::PASSWORD])
            ->assertOk()
            ->assertJsonPath('data.email', 'spa@example.com');

        $this->assertAuthenticated('web');
    }

    public function test_mobile_token_authenticates_and_logout_revokes_it(): void
    {
        $user = User::factory()->create(['email' => 'mobile@example.com', 'password' => self::PASSWORD]);

        $token = $this->postJson($this->prefix.'/auth/token', [
            'email' => 'mobile@example.com',
            'password' => self::PASSWORD,
            'device_name' => 'celular-teste',
        ])->assertCreated()
            ->assertJsonPath('token_type', 'Bearer')
            ->json('token');

        $this->withToken($token)->getJson($this->prefix.'/auth/user')
            ->assertOk()
            ->assertJsonPath('data.id', $user->getKey());

        $this->withToken($token)->postJson($this->prefix.'/auth/logout')->assertNoContent();

        $this->flushAuthGuards();

        $this->withToken($token)->getJson($this->prefix.'/auth/user')->assertUnauthorized();
    }

    public function test_token_endpoint_rejects_invalid_credentials(): void
    {
        User::factory()->create(['email' => 'x@example.com', 'password' => self::PASSWORD]);

        $this->postJson($this->prefix.'/auth/token', [
            'email' => 'x@example.com',
            'password' => 'nope-nope',
            'device_name' => 'celular',
        ])->assertUnauthorized()->assertJsonPath('error', 'invalid_credentials');
    }

    public function test_protected_routes_require_authentication(): void
    {
        $this->getJson($this->prefix.'/organizations')->assertUnauthorized();
        $this->getJson($this->prefix.'/me/lessons')->assertUnauthorized();
    }

    public function test_signed_verification_link_confirms_email(): void
    {
        $user = User::factory()->unverified()->create();

        $url = URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), [
            'id' => $user->getKey(),
            'hash' => sha1($user->getEmailForVerification()),
        ]);

        $this->getJson($url)->assertOk();

        $this->assertTrue($user->fresh()->hasVerifiedEmail());
    }

    public function test_verification_link_with_wrong_hash_is_rejected(): void
    {
        $user = User::factory()->unverified()->create();

        $url = URL::temporarySignedRoute('verification.verify', now()->addMinutes(60), [
            'id' => $user->getKey(),
            'hash' => sha1('outro@example.com'),
        ]);

        $this->getJson($url)->assertForbidden()->assertJsonPath('error', 'invalid_verification_link');
        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_instructor_profile_can_be_created_read_and_updated_by_own_account(): void
    {
        $user = User::factory()->create(['name' => 'João Silva']);
        $this->actingAsUser($user);

        $this->getJson($this->prefix.'/me/instructor')->assertNotFound();

        $this->postJson($this->prefix.'/me/instructor', [
            'full_name' => 'João Silva',
            'credential_number' => '12345',
            'categories' => ['A', 'B'],
        ])->assertCreated()->assertJsonPath('data.categories', ['A', 'B']);

        $this->postJson($this->prefix.'/me/instructor', ['full_name' => 'Outro', 'categories' => []])
            ->assertConflict()->assertJsonPath('error', 'instructor_profile_exists');

        $this->patchJson($this->prefix.'/me/instructor', ['categories' => ['B', 'C']])
            ->assertOk()->assertJsonPath('data.categories', ['B', 'C']);

        $this->patchJson($this->prefix.'/me/instructor', ['categories' => ['ZZ']])
            ->assertUnprocessable()->assertJsonValidationErrors('categories.0');
    }

    private function flushAuthGuards(): void
    {
        $this->app['auth']->forgetGuards();
    }
}
