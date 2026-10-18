<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\Enrollment;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\User;

/**
 * Matriz de permissões na API: o que cada papel pode (e não pode) alcançar, inclusive por atalhos,
 * erros e troca de espaço. O web só esconde o que a API já nega.
 */
class PermissionMatrixTest extends ApiTestCase
{
    private Organization $org;

    /** @var array<string, User> */
    private array $users = [];

    private Enrollment $enrollment;

    private string $base;

    protected function setUp(): void
    {
        parent::setUp();

        $this->users['owner'] = User::factory()->create();
        $this->org = $this->organizationWithOwner('cfc', $this->users['owner']);
        $this->base = $this->prefix."/organizations/{$this->org->getKey()}";

        foreach (['admin' => MembershipRole::Admin, 'staff' => MembershipRole::Staff, 'instructor' => MembershipRole::Instructor] as $key => $role) {
            $this->users[$key] = User::factory()->create();
            $this->addMember($this->org, $this->users[$key], $role);
        }

        $mine = Instructor::factory()->create(['user_id' => $this->users['instructor']->getKey()]);
        $this->org->instructors()->attach($mine->getKey(), ['active' => true]);

        $this->enrollment = $this->enrollmentFor($this->org);
        $this->enrollment->update(['price_cents' => 150000, 'notes' => 'Pagamento combinado']);
        $window = $this->window(3);
        $this->actingAsUser($this->users['owner'])->postJson("{$this->base}/lessons", [
            'enrollment_id' => $this->enrollment->getKey(), 'instructor_id' => $mine->getKey(), 'starts_at' => $window[0], 'ends_at' => $window[1],
        ])->assertCreated();

        $this->users['outsider'] = $this->organizationWithOwner()->members()->first();
    }

    /**
     * @return array<string, array{0: string, 1: string, 2: array<string, int>}> método, caminho e status por papel
     */
    private function matrix(): array
    {
        $vehicle = $this->vehicleFor($this->org);
        $e = $this->enrollment->getKey();
        $block = ['resource_type' => 'vehicle', 'vehicle_id' => $vehicle->getKey(), 'kind' => 'other', 'reason' => 'Teste', 'starts_at' => now()->addDays(20)->toIso8601String(), 'ends_at' => now()->addDays(21)->toIso8601String()];

        return [
            'membros' => ['GET', '/members', ['owner' => 200, 'admin' => 200, 'staff' => 403, 'instructor' => 403, 'outsider' => 404]],
            'convites' => ['GET', '/invitations', ['owner' => 200, 'admin' => 200, 'staff' => 403, 'instructor' => 403, 'outsider' => 404]],
            'auditoria' => ['GET', '/audit-events', ['owner' => 200, 'admin' => 200, 'staff' => 403, 'instructor' => 403, 'outsider' => 404]],
            'instrutores' => ['GET', '/instructors', ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 403, 'outsider' => 404]],
            'processos' => ['GET', '/qualification-processes', ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 403, 'outsider' => 404]],
            'documentos' => ['GET', '/documents', ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 403, 'outsider' => 404]],
            'taxas' => ['GET', '/external-fees', ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 403, 'outsider' => 404]],
            'manutencoes' => ['GET', '/maintenances', ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 403, 'outsider' => 404]],
            'visao do veiculo' => ['GET', "/vehicles/{$vehicle->getKey()}/overview", ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 403, 'outsider' => 404]],
            'primeiros passos' => ['GET', '/onboarding', ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 403, 'outsider' => 404]],
            'bloquear veiculo' => ['POST', '/availability-blocks', ['owner' => 201, 'admin' => 201, 'staff' => 201, 'instructor' => 403, 'outsider' => 404], $block],
            'ajustes de alerta' => ['PATCH', '/alert-settings', ['owner' => 200, 'admin' => 200, 'staff' => 403, 'instructor' => 403, 'outsider' => 404], ['inactive_days' => 20]],
            'pendencias' => ['GET', '/alerts', ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 200, 'outsider' => 404]],
            'agenda' => ['GET', '/lessons', ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 200, 'outsider' => 404]],
            'exames' => ['GET', '/exams', ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 200, 'outsider' => 404]],
            'matricula' => ['GET', "/enrollments/{$e}", ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 200, 'outsider' => 404]],
            'saldo' => ['GET', "/enrollments/{$e}/balance", ['owner' => 200, 'admin' => 200, 'staff' => 200, 'instructor' => 403, 'outsider' => 404]],
            'ajuste de saldo' => ['POST', "/enrollments/{$e}/credit-adjustments", ['owner' => 201, 'admin' => 201, 'staff' => 403, 'instructor' => 403, 'outsider' => 404], ['minutes' => 5, 'reason' => 'Ajuste de teste']],
        ];
    }

    public function test_matrix_by_role(): void
    {
        foreach ($this->matrix() as $name => $row) {
            [$method, $path, $expected] = $row;
            $payload = $row[3] ?? [];

            foreach ($expected as $role => $status) {
                // Um bloqueio criado por um papel não pode influenciar o próximo: cada chamada usa período livre.
                $body = $payload;
                if ($name === 'bloquear veiculo') {
                    $body['starts_at'] = now()->addDays(30 + array_search($role, array_keys($expected)) * 2)->toIso8601String();
                    $body['ends_at'] = now()->addDays(31 + array_search($role, array_keys($expected)) * 2)->toIso8601String();
                }

                $response = $this->actingAsUser($this->users[$role])->json($method, $this->base.$path, $body);
                $this->assertSame($status, $response->status(), "{$name} como {$role}: esperado {$status}, veio {$response->status()}");
            }
        }
    }

    public function test_price_notes_and_student_contacts_never_reach_the_instructor(): void
    {
        $response = $this->actingAsUser($this->users['instructor'])->getJson("{$this->base}/enrollments/{$this->enrollment->getKey()}")->assertOk();
        $json = $response->getContent();

        $this->assertStringNotContainsString('price_cents', $json);
        $this->assertStringNotContainsString('150000', $json);
        $this->assertStringNotContainsString('Pagamento combinado', $json);
        $this->assertArrayNotHasKey('balance', $response->json('data'));

        $student = $this->actingAsUser($this->users['instructor'])->getJson("{$this->base}/students/{$this->enrollment->student_id}")->assertOk()->json('data');
        $this->assertArrayNotHasKey('cpf', $student);
        $this->assertArrayNotHasKey('birth_date', $student);

        // Erros de permissão não vazam dados do registro.
        $denied = $this->actingAsUser($this->users['instructor'])->getJson("{$this->base}/documents")->assertForbidden()->getContent();
        $this->assertStringNotContainsString($this->enrollment->student->name, $denied);
    }

    public function test_changing_space_never_exposes_records_of_another_space(): void
    {
        $other = $this->organizationWithOwner();
        $foreignStudent = \App\Models\Student::factory()->for($other)->create();
        $foreignVehicle = $this->vehicleFor($other);
        $foreignEnrollment = $this->enrollmentFor($other);

        foreach ([
            "/students/{$foreignStudent->getKey()}", "/vehicles/{$foreignVehicle->getKey()}", "/enrollments/{$foreignEnrollment->getKey()}",
            "/vehicles/{$foreignVehicle->getKey()}/overview", "/enrollments/{$foreignEnrollment->getKey()}/balance",
        ] as $path) {
            foreach (['owner', 'staff'] as $role) {
                $this->actingAsUser($this->users[$role])->getJson($this->base.$path)->assertNotFound();
            }
        }

        // Uso de IDs de outro espaço em formulários também é recusado.
        $this->actingAsUser($this->users['owner'])->postJson("{$this->base}/availability-blocks", [
            'resource_type' => 'vehicle', 'vehicle_id' => $foreignVehicle->getKey(), 'kind' => 'other', 'reason' => 'Teste',
            'starts_at' => now()->addDay()->toIso8601String(), 'ends_at' => now()->addDays(2)->toIso8601String(),
        ])->assertUnprocessable();
        $this->actingAsUser($this->users['owner'])->postJson("{$this->base}/maintenances", [
            'vehicle_id' => $foreignVehicle->getKey(), 'type' => 'Teste', 'scheduled_on' => now()->toDateString(),
        ])->assertUnprocessable();
    }
}
