<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\Document;
use App\Models\Student;
use App\Models\User;

class QualificationProcessTest extends ApiTestCase
{
    private User $owner;

    private $org;

    private string $base;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->org = $this->organizationWithOwner('cfc', $this->owner);
        $this->base = $this->prefix."/organizations/{$this->org->getKey()}";
    }

    private function create(array $overrides = [])
    {
        $student = Student::factory()->for($this->org)->create();

        return $this->actingAsUser($this->owner)->postJson("{$this->base}/qualification-processes", $overrides + [
            'student_id' => $student->getKey(),
            'type' => 'first_license',
            'uf' => 'mg',
            'municipality' => 'Belo Horizonte',
            'renach' => 'MG123456789',
            'target_categories' => ['B'],
        ]);
    }

    public function test_first_license_creates_checklist_and_is_not_released_yet(): void
    {
        $response = $this->create()
            ->assertCreated()
            ->assertJsonPath('data.uf', 'MG')
            ->assertJsonPath('data.status', 'preparing')
            ->assertJsonPath('data.practice_release.released', false);

        $types = collect($response->json('data.checklist'))->pluck('type')->all();
        $this->assertEqualsCanonicalizing(
            ['theory_completion', 'learning_license', 'medical_exam', 'psychological_exam', 'toxicological_exam'],
            $types,
        );

        // Toxicológico de primeira habilitação não bloqueia o início das aulas.
        $this->assertNotContains('toxicological_exam', $response->json('data.practice_release.pending'));
    }

    public function test_refresher_only_requires_current_license(): void
    {
        $this->create(['type' => 'refresher', 'current_categories' => ['B'], 'target_categories' => ['B']])
            ->assertCreated()
            ->assertJsonPath('data.practice_release.pending', ['current_license']);
    }

    public function test_current_categories_are_required_for_holders_and_forbidden_for_first_license(): void
    {
        $this->create(['type' => 'category_addition'])
            ->assertUnprocessable()->assertJsonValidationErrors('current_categories');

        $this->create(['type' => 'first_license', 'current_categories' => ['A']])
            ->assertUnprocessable()->assertJsonValidationErrors('current_categories');
    }

    public function test_student_from_another_organization_is_rejected(): void
    {
        $foreign = Student::factory()->for($this->organizationWithOwner())->create();

        $this->create(['student_id' => $foreign->getKey()])
            ->assertUnprocessable()->assertJsonValidationErrors('student_id');
    }

    public function test_type_and_student_cannot_change(): void
    {
        $id = $this->create()->json('data.id');

        $this->actingAsUser($this->owner)
            ->patchJson("{$this->base}/qualification-processes/{$id}", ['type' => 'refresher'])
            ->assertUnprocessable()->assertJsonValidationErrors('type');

        $this->actingAsUser($this->owner)
            ->patchJson("{$this->base}/qualification-processes/{$id}", ['status' => 'active', 'renach' => 'X1'])
            ->assertOk()->assertJsonPath('data.status', 'active')->assertJsonPath('data.renach', 'X1');
    }

    public function test_instructor_cannot_access_processes(): void
    {
        $id = $this->create()->json('data.id');
        $user = User::factory()->create();
        $this->addMember($this->org, $user, MembershipRole::Instructor);

        $this->actingAsUser($user)->getJson("{$this->base}/qualification-processes")->assertForbidden();
        $this->actingAsUser($user)->getJson("{$this->base}/qualification-processes/{$id}")->assertForbidden();
    }

    public function test_other_organization_gets_404(): void
    {
        $id = $this->create()->json('data.id');
        $outsider = User::factory()->create();
        $other = $this->organizationWithOwner('cfc', $outsider);

        $this->actingAsUser($outsider)
            ->getJson($this->prefix."/organizations/{$other->getKey()}/qualification-processes/{$id}")
            ->assertNotFound();
    }

    // --- checklist ---------------------------------------------------------------

    private function item(int $processId, string $type): int
    {
        return collect($this->actingAsUser($this->owner)
            ->getJson("{$this->base}/qualification-processes/{$processId}")->json('data.checklist'))
            ->firstWhere('type', $type)['id'];
    }

    private function patchItem(int $processId, int $itemId, array $data)
    {
        return $this->actingAsUser($this->owner)
            ->patchJson("{$this->base}/qualification-processes/{$processId}/checklist-items/{$itemId}", $data);
    }

    public function test_verifying_an_item_records_who_checked_and_requires_a_trusted_source(): void
    {
        $processId = $this->create()->json('data.id');
        $itemId = $this->item($processId, 'learning_license');

        $this->patchItem($processId, $itemId, ['status' => 'verified'])
            ->assertUnprocessable()->assertJsonPath('error', 'verification_source_required');

        $this->patchItem($processId, $itemId, ['status' => 'verified', 'source' => 'student_declared'])
            ->assertUnprocessable()->assertJsonPath('error', 'verification_source_required');

        $this->patchItem($processId, $itemId, ['status' => 'verified', 'source' => 'document', 'reference' => 'LA-1'])
            ->assertOk()
            ->assertJsonPath('data.status', 'verified')
            ->assertJsonPath('data.checked_by.id', $this->owner->getKey());
    }

    public function test_leaving_verified_clears_the_check_mark(): void
    {
        $processId = $this->create()->json('data.id');
        $itemId = $this->item($processId, 'learning_license');
        $this->patchItem($processId, $itemId, ['status' => 'verified', 'source' => 'document'])->assertOk();

        $this->patchItem($processId, $itemId, ['status' => 'pending'])
            ->assertOk()->assertJsonPath('data.checked_at', null)->assertJsonMissingPath('data.checked_by');
    }

    public function test_not_applicable_and_blocked_require_a_reason(): void
    {
        $processId = $this->create()->json('data.id');
        $itemId = $this->item($processId, 'psychological_exam');

        $this->patchItem($processId, $itemId, ['status' => 'not_applicable'])
            ->assertUnprocessable()->assertJsonPath('error', 'reason_required');

        $this->patchItem($processId, $itemId, ['status' => 'blocked'])
            ->assertUnprocessable()->assertJsonPath('error', 'reason_required');

        $this->patchItem($processId, $itemId, ['status' => 'not_applicable', 'notes' => 'Aproveitamento aceito pelo órgão.'])
            ->assertOk()->assertJsonPath('data.status', 'not_applicable');
    }

    public function test_required_flag_cannot_be_edited(): void
    {
        $processId = $this->create()->json('data.id');
        $itemId = $this->item($processId, 'medical_exam');

        $this->patchItem($processId, $itemId, ['required' => false])
            ->assertUnprocessable()->assertJsonValidationErrors('required');
    }

    public function test_staff_can_add_a_requirement_but_not_duplicate_one(): void
    {
        $processId = $this->create(['type' => 'category_addition', 'current_categories' => ['A']])->json('data.id');
        $url = "{$this->base}/qualification-processes/{$processId}/checklist-items";

        // O modelo de adição não traz toxicológico: acrescentar a exigência é permitido.
        $this->actingAsUser($this->owner)->postJson($url, ['type' => 'toxicological_exam'])
            ->assertCreated()->assertJsonPath('data.required', true)->assertJsonPath('data.status', 'pending');

        $this->actingAsUser($this->owner)->postJson($url, ['type' => 'toxicological_exam'])
            ->assertUnprocessable()->assertJsonValidationErrors('type');

        // Psicológico já existe (opcional) e não pode ser duplicado.
        $this->actingAsUser($this->owner)->postJson($url, ['type' => 'psychological_exam'])
            ->assertUnprocessable()->assertJsonValidationErrors('type');
    }

    public function test_practice_is_released_only_when_every_required_item_is_cleared(): void
    {
        $processId = $this->create()->json('data.id');

        foreach (['theory_completion', 'learning_license', 'medical_exam'] as $type) {
            $this->patchItem($processId, $this->item($processId, $type), ['status' => 'verified', 'source' => 'document'])->assertOk();
        }

        $this->actingAsUser($this->owner)->getJson("{$this->base}/qualification-processes/{$processId}")
            ->assertJsonPath('data.practice_release.released', false)
            ->assertJsonPath('data.practice_release.pending', ['psychological_exam']);

        $this->patchItem($processId, $this->item($processId, 'psychological_exam'), [
            'status' => 'not_applicable', 'notes' => 'Dispensa confirmada pelo atendimento oficial.',
        ])->assertOk();

        $this->actingAsUser($this->owner)->getJson("{$this->base}/qualification-processes/{$processId}")
            ->assertJsonPath('data.practice_release.released', true);
    }

    public function test_document_from_another_student_cannot_be_linked_to_an_item(): void
    {
        $processId = $this->create()->json('data.id');
        $itemId = $this->item($processId, 'learning_license');

        $otherStudent = Student::factory()->for($this->org)->create();
        $document = Document::create([
            'organization_id' => $this->org->getKey(), 'type' => 'learning_license', 'student_id' => $otherStudent->getKey(),
            'storage_path' => 'x', 'original_name' => 'x.pdf', 'mime_type' => 'application/pdf', 'size' => 1,
        ]);

        $this->patchItem($processId, $itemId, ['document_id' => $document->getKey()])
            ->assertUnprocessable()->assertJsonValidationErrors('document_id');
    }
}
