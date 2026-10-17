<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\Document;
use App\Models\Student;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

class DocumentTest extends ApiTestCase
{
    private User $owner;

    private $org;

    private Student $student;

    private string $base;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');

        $this->owner = User::factory()->create();
        $this->org = $this->organizationWithOwner('cfc', $this->owner);
        $this->student = Student::factory()->for($this->org)->create();
        $this->base = $this->prefix."/organizations/{$this->org->getKey()}";
    }

    private function upload(array $overrides = [], ?UploadedFile $file = null, ?User $as = null)
    {
        return $this->actingAsUser($as ?? $this->owner)->post("{$this->base}/documents", $overrides + [
            'file' => $file ?? UploadedFile::fake()->create('licenca.pdf', 200, 'application/pdf'),
            'type' => 'learning_license',
            'student_id' => $this->student->getKey(),
        ], ['Accept' => 'application/json']);
    }

    public function test_upload_stores_privately_and_never_exposes_the_path(): void
    {
        $response = $this->upload()
            ->assertCreated()
            ->assertJsonPath('data.status', 'attached')
            ->assertJsonPath('data.version', 1)
            ->assertJsonPath('data.original_name', 'licenca.pdf')
            ->assertJsonMissingPath('data.storage_path');

        $document = Document::findOrFail($response->json('data.id'));
        Storage::disk('local')->assertExists($document->storage_path);
        $this->assertStringNotContainsString('licenca', $document->storage_path); // nome aleatório
        $this->assertStringNotContainsString($document->storage_path, $response->getContent());
    }

    public function test_rejects_unsupported_file_types_and_oversized_files(): void
    {
        $this->upload([], UploadedFile::fake()->create('script.php', 10, 'text/x-php'))
            ->assertUnprocessable()->assertJsonValidationErrors('file');

        $this->upload([], UploadedFile::fake()->create('grande.pdf', 20000, 'application/pdf'))
            ->assertUnprocessable()->assertJsonValidationErrors('file');
    }

    public function test_requires_an_owner(): void
    {
        $this->actingAsUser($this->owner)->post("{$this->base}/documents", [
            'file' => UploadedFile::fake()->create('a.pdf', 10, 'application/pdf'),
            'type' => 'other',
        ], ['Accept' => 'application/json'])->assertUnprocessable()->assertJsonValidationErrors('student_id');
    }

    public function test_process_owner_derives_the_student(): void
    {
        [$process] = $this->processWithEnrollment($this->org, $this->owner);

        $this->upload(['student_id' => null, 'qualification_process_id' => $process->getKey()])
            ->assertCreated()
            ->assertJsonPath('data.student_id', $process->student_id);
    }

    public function test_owners_from_another_organization_are_rejected(): void
    {
        $foreignStudent = Student::factory()->for($this->organizationWithOwner())->create();

        $this->upload(['student_id' => $foreignStudent->getKey()])
            ->assertUnprocessable()->assertJsonValidationErrors('student_id');
    }

    public function test_download_returns_the_original_file_to_staff(): void
    {
        $id = $this->upload()->json('data.id');

        $this->actingAsUser($this->owner)->get("{$this->base}/documents/{$id}/download")
            ->assertOk()
            ->assertDownload('licenca.pdf');
    }

    public function test_instructors_cannot_list_see_or_download_documents(): void
    {
        $id = $this->upload()->json('data.id');
        $user = User::factory()->create();
        $this->addMember($this->org, $user, MembershipRole::Instructor);

        $this->actingAsUser($user)->getJson("{$this->base}/documents")->assertForbidden();
        $this->actingAsUser($user)->getJson("{$this->base}/documents/{$id}")->assertForbidden();
        $this->actingAsUser($user)->get("{$this->base}/documents/{$id}/download", ['Accept' => 'application/json'])->assertForbidden();
        $this->upload([], null, $user)->assertForbidden();
    }

    public function test_other_organization_cannot_reach_the_document(): void
    {
        $id = $this->upload()->json('data.id');
        $outsider = User::factory()->create();
        $other = $this->organizationWithOwner('cfc', $outsider);
        $otherBase = $this->prefix."/organizations/{$other->getKey()}";

        $this->actingAsUser($outsider)->getJson("{$otherBase}/documents/{$id}")->assertNotFound();
        $this->actingAsUser($outsider)->get("{$otherBase}/documents/{$id}/download", ['Accept' => 'application/json'])->assertNotFound();
        $this->actingAsUser($this->owner)->getJson("{$this->base}/documents?student_id={$this->student->getKey()}")
            ->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_verifying_records_who_and_when_and_does_not_complete_any_checklist_item(): void
    {
        [$process] = $this->processWithEnrollment($this->org, $this->owner);
        $id = $this->upload(['student_id' => null, 'qualification_process_id' => $process->getKey()])->assertCreated()->json('data.id');

        $this->actingAsUser($this->owner)->patchJson("{$this->base}/documents/{$id}", ['status' => 'verified'])
            ->assertOk()
            ->assertJsonPath('data.status', 'verified')
            ->assertJsonPath('data.verified_by', $this->owner->getKey());

        // Upload e conferência do arquivo não conferem o item do checklist.
        $this->assertSame(0, $process->checklistItems()->where('status', 'verified')->count());
    }

    public function test_replacing_creates_a_new_version_and_keeps_history(): void
    {
        $first = $this->upload()->json('data.id');

        $second = $this->upload(['replaces_document_id' => $first])
            ->assertCreated()->assertJsonPath('data.version', 2)->assertJsonPath('data.replaces_document_id', $first)
            ->json('data.id');

        $this->assertDatabaseHas('documents', ['id' => $first, 'status' => 'replaced']);
        $this->assertDatabaseHas('documents', ['id' => $second, 'status' => 'attached']);

        // A versão antiga não é mais a vigente.
        $this->upload(['replaces_document_id' => $first])
            ->assertUnprocessable()->assertJsonPath('error', 'document_not_replaceable');

        $this->actingAsUser($this->owner)->patchJson("{$this->base}/documents/{$first}", ['status' => 'verified'])
            ->assertUnprocessable()->assertJsonPath('error', 'document_replaced');
    }

    public function test_replacement_must_keep_type_and_owner(): void
    {
        $first = $this->upload()->json('data.id');
        $otherStudent = Student::factory()->for($this->org)->create();

        $this->upload(['replaces_document_id' => $first, 'type' => 'contract'])
            ->assertUnprocessable()->assertJsonPath('error', 'document_not_replaceable');
        $this->upload(['replaces_document_id' => $first, 'student_id' => $otherStudent->getKey()])
            ->assertUnprocessable()->assertJsonPath('error', 'document_not_replaceable');

        $this->assertSame(1, Document::count());
        $this->assertCount(1, Storage::disk('local')->allFiles()); // arquivos órfãos são removidos
    }

    public function test_vehicle_document(): void
    {
        $vehicle = $this->vehicleFor($this->org);

        $this->upload(['type' => 'vehicle_registration', 'student_id' => null, 'vehicle_id' => $vehicle->getKey(), 'expires_at' => now()->addYear()->toDateString()])
            ->assertCreated()->assertJsonPath('data.vehicle_id', $vehicle->getKey());
    }
}
