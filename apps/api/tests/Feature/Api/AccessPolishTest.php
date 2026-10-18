<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\Student;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

/**
 * Módulo 6 — acesso, correções e acabamento.
 */
class AccessPolishTest extends ApiTestCase
{
    private User $owner;

    private $org;

    private string $base;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create(['password' => 'senha-antiga']);
        $this->org = $this->organizationWithOwner('cfc', $this->owner);
        $this->base = $this->prefix."/organizations/{$this->org->getKey()}";
    }

    private function resetToken(User $user): string
    {
        Notification::fake();
        $this->postJson("{$this->prefix}/auth/forgot-password", ['email' => $user->email])->assertOk();

        $token = null;
        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $n) use (&$token, $user) {
            $token = $n->token;
            $url = $n->toMail($user)->actionUrl;
            $this->assertStringContainsString('/redefinir-senha?token='.$token, $url);
            $this->assertStringContainsString('email='.urlencode($user->email), $url);

            return true;
        });

        return $token;
    }

    public function test_forgot_password_never_reveals_whether_the_account_exists(): void
    {
        Notification::fake();

        $known = $this->postJson("{$this->prefix}/auth/forgot-password", ['email' => $this->owner->email])->assertOk();
        $unknown = $this->postJson("{$this->prefix}/auth/forgot-password", ['email' => 'ninguem@exemplo.com'])->assertOk();

        $this->assertSame($known->json(), $unknown->json());
        Notification::assertSentToTimes($this->owner, ResetPassword::class, 1);
        Notification::assertNothingSentTo(User::factory()->make(['email' => 'ninguem@exemplo.com']));
    }

    public function test_reset_link_is_single_use_expires_and_ends_other_sessions(): void
    {
        $token = $this->resetToken($this->owner);
        $this->owner->createToken('celular');
        $this->assertSame(1, $this->owner->tokens()->count());

        $payload = ['email' => $this->owner->email, 'token' => $token, 'password' => 'nova-senha-1', 'password_confirmation' => 'nova-senha-1'];
        $this->postJson("{$this->prefix}/auth/reset-password", $payload)->assertOk();

        $this->assertTrue(Hash::check('nova-senha-1', $this->owner->fresh()->password));
        $this->assertSame(0, $this->owner->tokens()->count());

        // Segundo uso do mesmo link: recusado.
        $this->postJson("{$this->prefix}/auth/reset-password", $payload)->assertUnprocessable()->assertJsonPath('error', 'invalid_reset_token');

        $this->postJson("{$this->prefix}/auth/token", ['email' => $this->owner->email, 'password' => 'nova-senha-1', 'device_name' => 'teste'])->assertCreated();
    }

    public function test_expired_or_forged_reset_link_is_rejected_with_the_same_error(): void
    {
        $token = $this->resetToken($this->owner);
        $payload = ['email' => $this->owner->email, 'password' => 'nova-senha-1', 'password_confirmation' => 'nova-senha-1'];

        $this->postJson("{$this->prefix}/auth/reset-password", $payload + ['token' => 'falso'])->assertUnprocessable()->assertJsonPath('error', 'invalid_reset_token');
        $this->postJson("{$this->prefix}/auth/reset-password", ['email' => 'outro@exemplo.com'] + $payload + ['token' => $token])->assertUnprocessable()->assertJsonPath('error', 'invalid_reset_token');

        $this->travel(61)->minutes();
        $this->postJson("{$this->prefix}/auth/reset-password", $payload + ['token' => $token])->assertUnprocessable()->assertJsonPath('error', 'invalid_reset_token');
        $this->assertTrue(Hash::check('senha-antiga', $this->owner->fresh()->password));
    }

    public function test_recovery_requests_are_rate_limited(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson("{$this->prefix}/auth/forgot-password", ['email' => 'x@exemplo.com'])->assertOk();
        }

        $this->postJson("{$this->prefix}/auth/forgot-password", ['email' => 'x@exemplo.com'])->assertStatus(429);
    }

    public function test_change_password_needs_the_current_one_and_keeps_only_this_session(): void
    {
        $keep = $this->owner->createToken('este');
        $this->owner->createToken('outro');

        $this->withToken($keep->plainTextToken)->postJson("{$this->prefix}/auth/password", [
            'current_password' => 'errada', 'password' => 'nova-senha-1', 'password_confirmation' => 'nova-senha-1',
        ])->assertUnprocessable()->assertJsonValidationErrors('current_password');

        $this->withToken($keep->plainTextToken)->postJson("{$this->prefix}/auth/password", [
            'current_password' => 'senha-antiga', 'password' => 'senha-antiga', 'password_confirmation' => 'senha-antiga',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->withToken($keep->plainTextToken)->postJson("{$this->prefix}/auth/password", [
            'current_password' => 'senha-antiga', 'password' => 'nova-senha-1', 'password_confirmation' => 'nova-senha-1',
        ])->assertOk();

        $this->assertTrue(Hash::check('nova-senha-1', $this->owner->fresh()->password));
        $this->assertSame([$keep->accessToken->getKey()], $this->owner->tokens()->pluck('id')->all());
    }

    public function test_password_policy_is_configurable_and_validation_messages_are_in_portuguese(): void
    {
        config(['autoescola.password_min' => 8]);

        $response = $this->postJson("{$this->prefix}/auth/register", ['name' => 'Ana', 'email' => 'ana@exemplo.com', 'password' => 'curta', 'password_confirmation' => 'curta'])
            ->assertUnprocessable();
        $this->assertStringContainsString('ao menos 8 caracteres', $response->json('errors.password.0'));

        $missing = $this->postJson("{$this->prefix}/auth/register", [])->assertUnprocessable();
        $this->assertStringContainsString('Preencha', $missing->json('errors.name.0'));
        $this->assertStringNotContainsString('field is required', $missing->getContent());
    }

    public function test_idempotency_key_prevents_duplicate_creation_and_replays_the_answer(): void
    {
        $payload = ['name' => 'Aluno Único', 'phone' => '31999990000'];
        $headers = ['Idempotency-Key' => 'chave-de-teste-0001'];

        $first = $this->actingAsUser($this->owner)->postJson("{$this->base}/students", $payload, $headers)->assertCreated();
        $second = $this->actingAsUser($this->owner)->postJson("{$this->base}/students", $payload, $headers)->assertCreated();

        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $second->assertHeader('Idempotent-Replay', 'true');
        $this->assertSame(1, Student::count());

        // Mesma chave com conteúdo diferente: recusada.
        $this->actingAsUser($this->owner)->postJson("{$this->base}/students", ['name' => 'Outro'], $headers)
            ->assertUnprocessable()->assertJsonPath('error', 'idempotency_key_reused');

        // Sem chave não há proteção (comportamento anterior preservado).
        $this->actingAsUser($this->owner)->postJson("{$this->base}/students", ['name' => 'Sem chave'])->assertCreated();
        $this->actingAsUser($this->owner)->postJson("{$this->base}/students", ['name' => 'Sem chave'])->assertCreated();
        $this->assertSame(3, Student::count());
    }

    public function test_failed_attempts_are_not_cached_so_a_corrected_retry_works(): void
    {
        $headers = ['Idempotency-Key' => 'chave-de-teste-0002'];

        $this->actingAsUser($this->owner)->postJson("{$this->base}/students", ['name' => ''], $headers)->assertUnprocessable();
        $this->actingAsUser($this->owner)->postJson("{$this->base}/students", ['name' => 'Corrigido'], $headers)->assertCreated();
        $this->assertSame(1, Student::count());
    }

    public function test_simultaneous_edit_is_detected_instead_of_silently_overwritten(): void
    {
        $student = Student::factory()->for($this->org)->create(['name' => 'Original']);
        $opened = $this->actingAsUser($this->owner)->getJson("{$this->base}/students/{$student->getKey()}")->json('data.updated_at');

        // Outra pessoa salva antes.
        $this->travel(5)->seconds();
        $this->actingAsUser($this->owner)->patchJson("{$this->base}/students/{$student->getKey()}", ['name' => 'Colega alterou'])->assertOk();

        $this->actingAsUser($this->owner)->patchJson("{$this->base}/students/{$student->getKey()}", ['name' => 'Eu alterei', 'expected_updated_at' => $opened])
            ->assertStatus(409)->assertJsonPath('error', 'stale_record');
        $this->assertSame('Colega alterou', $student->fresh()->name);

        // Com a versão atual, salva.
        $current = $this->actingAsUser($this->owner)->getJson("{$this->base}/students/{$student->getKey()}")->json('data.updated_at');
        $this->actingAsUser($this->owner)->patchJson("{$this->base}/students/{$student->getKey()}", ['name' => 'Eu alterei', 'expected_updated_at' => $current])->assertOk();
    }

    public function test_archive_and_restore_student_keep_history_and_explain_cpf_and_commitments(): void
    {
        $student = Student::factory()->for($this->org)->create(['cpf' => '12345678909']);
        $enrollment = Enrollment::create(['organization_id' => $this->org->getKey(), 'student_id' => $student->getKey(), 'category' => 'B']);
        $instructor = $this->linkInstructor($this->org);
        $window = $this->window(3);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/lessons", [
            'enrollment_id' => $enrollment->getKey(), 'instructor_id' => $instructor->getKey(), 'starts_at' => $window[0], 'ends_at' => $window[1],
        ])->assertCreated();

        // Com aula agendada e matrícula em andamento: recusado, dizendo o que fazer.
        $this->actingAsUser($this->owner)->deleteJson("{$this->base}/students/{$student->getKey()}")
            ->assertUnprocessable()->assertJsonPath('error', 'student_has_commitments');

        Lesson::query()->update(['status' => 'cancelled']);
        $this->actingAsUser($this->owner)->deleteJson("{$this->base}/students/{$student->getKey()}")
            ->assertUnprocessable()->assertJsonPath('error', 'student_has_open_enrollments');

        $enrollment->update(['status' => 'closed']);
        $this->actingAsUser($this->owner)->deleteJson("{$this->base}/students/{$student->getKey()}")->assertNoContent();

        $this->actingAsUser($this->owner)->getJson("{$this->base}/students")->assertJsonCount(0, 'data');
        $this->actingAsUser($this->owner)->getJson("{$this->base}/students?archived=1")->assertJsonCount(1, 'data');

        // CPF reservado ao cadastro arquivado, com orientação.
        $response = $this->actingAsUser($this->owner)->postJson("{$this->base}/students", ['name' => 'Duplicado', 'cpf' => '12345678909'])->assertUnprocessable();
        $this->assertStringContainsString('arquivado', $response->json('errors.cpf.0'));

        $this->actingAsUser($this->owner)->postJson("{$this->base}/students/{$student->getKey()}/restore")->assertOk()->assertJsonPath('data.name', $student->name);
        $this->actingAsUser($this->owner)->getJson("{$this->base}/students")->assertJsonCount(1, 'data');
        $this->assertDatabaseHas('audit_events', ['event' => 'student.archived']);
        $this->assertDatabaseHas('audit_events', ['event' => 'student.restored']);
    }

    public function test_archive_and_restore_vehicle_and_partner(): void
    {
        $vehicle = $this->vehicleFor($this->org, overrides: ['plate' => 'ABC1D23']);
        $this->actingAsUser($this->owner)->deleteJson("{$this->base}/vehicles/{$vehicle->getKey()}")->assertNoContent();
        $this->actingAsUser($this->owner)->getJson("{$this->base}/vehicles?archived=1")->assertJsonCount(1, 'data');

        $response = $this->actingAsUser($this->owner)->postJson("{$this->base}/vehicles", ['plate' => 'ABC1D23', 'model' => 'Argo', 'category' => 'B'])->assertUnprocessable();
        $this->assertStringContainsString('arquivado', $response->json('errors.plate.0'));
        $this->actingAsUser($this->owner)->postJson("{$this->base}/vehicles/{$vehicle->getKey()}/restore")->assertOk()->assertJsonPath('data.plate', 'ABC1D23');

        $partnerId = $this->actingAsUser($this->owner)->postJson("{$this->base}/partners", ['name' => 'CFC Parceiro'])->assertCreated()->json('data.id');
        $this->actingAsUser($this->owner)->deleteJson("{$this->base}/partners/{$partnerId}")->assertNoContent();
        $this->actingAsUser($this->owner)->getJson("{$this->base}/partners?archived=1")->assertJsonCount(1, 'data');
        $this->actingAsUser($this->owner)->postJson("{$this->base}/partners/{$partnerId}/restore")->assertOk();
    }

    public function test_missing_document_file_and_version_chain(): void
    {
        Storage::fake(config('autoescola.documents_disk'));
        $student = Student::factory()->for($this->org)->create();

        $upload = fn (array $extra = []) => $this->actingAsUser($this->owner)->postJson("{$this->base}/documents", [
            'file' => UploadedFile::fake()->create('rg.pdf', 20, 'application/pdf'), 'type' => 'identity', 'student_id' => $student->getKey(),
        ] + $extra)->assertCreated();

        $v1 = $upload()->json('data.id');
        $v2 = $upload(['replaces_document_id' => $v1])->json('data.id');

        $versions = $this->actingAsUser($this->owner)->getJson("{$this->base}/documents/{$v1}/versions")->assertOk();
        $versions->assertJsonCount(2, 'data')->assertJsonPath('data.0.id', $v2)->assertJsonPath('data.0.version', 2)->assertJsonPath('data.1.status', 'replaced');

        Storage::disk(config('autoescola.documents_disk'))->deleteDirectory('organizations');
        $this->actingAsUser($this->owner)->get("{$this->base}/documents/{$v2}/download", ['Accept' => 'application/json'])
            ->assertNotFound()->assertJsonPath('error', 'document_file_missing');
    }

    public function test_onboarding_tracks_the_first_steps(): void
    {
        $this->actingAsUser($this->owner)->getJson("{$this->base}/onboarding")->assertOk()->assertJsonPath('data.done', 0)->assertJsonPath('data.total', 8);

        $this->linkInstructor($this->org);
        $this->vehicleFor($this->org);
        $enrollment = $this->enrollmentFor($this->org);
        $this->actingAsUser($this->owner)->postJson("{$this->base}/enrollments/{$enrollment->getKey()}/packages", ['description' => 'Pacote', 'minutes' => 600])->assertCreated();

        $this->actingAsUser($this->owner)->getJson("{$this->base}/onboarding")
            ->assertJsonPath('data.done', 5)
            ->assertJsonPath('data.steps.0.done', false);

        $instructorUser = User::factory()->create();
        $this->addMember($this->org, $instructorUser, MembershipRole::Instructor);
        $this->actingAsUser($instructorUser)->getJson("{$this->base}/onboarding")->assertForbidden();
    }

    public function test_enrollment_and_process_lists_filter_by_status_category_partner_and_search(): void
    {
        $partnerId = $this->actingAsUser($this->owner)->postJson("{$this->base}/partners", ['name' => 'CFC Parceiro'])->assertCreated()->json('data.id');
        $maria = Student::factory()->for($this->org)->create(['name' => 'Maria Souza']);
        $joao = Student::factory()->for($this->org)->create(['name' => 'João Lima']);
        Enrollment::create(['organization_id' => $this->org->getKey(), 'student_id' => $maria->getKey(), 'category' => 'B', 'partner_id' => $partnerId]);
        Enrollment::create(['organization_id' => $this->org->getKey(), 'student_id' => $joao->getKey(), 'category' => 'A', 'status' => 'in_service']);

        $list = fn (string $query) => $this->actingAsUser($this->owner)->getJson("{$this->base}/enrollments?{$query}")->assertOk();
        $list('category=B')->assertJsonCount(1, 'data')->assertJsonPath('data.0.student.name', 'Maria Souza');
        $list('status=in_service')->assertJsonCount(1, 'data')->assertJsonPath('data.0.student.name', 'João Lima');
        $list("partner_id={$partnerId}")->assertJsonCount(1, 'data');
        $list('search=Jo%C3%A3o')->assertJsonCount(1, 'data');
        $list('')->assertJsonCount(2, 'data');
    }
}
