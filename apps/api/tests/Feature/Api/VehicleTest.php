<?php

namespace Tests\Feature\Api;

use App\Enums\MembershipRole;
use App\Models\User;

class VehicleTest extends ApiTestCase
{
    private User $owner;

    private $org;

    protected function setUp(): void
    {
        parent::setUp();

        $this->owner = User::factory()->create();
        $this->org = $this->organizationWithOwner('cfc', $this->owner);
    }

    private function url(string $path = ''): string
    {
        return $this->prefix."/organizations/{$this->org->getKey()}/vehicles{$path}";
    }

    private function payload(array $overrides = []): array
    {
        return $overrides + ['plate' => 'abc-1d23', 'model' => 'Argo', 'brand' => 'Fiat', 'category' => 'B', 'year' => 2023];
    }

    public function test_creates_vehicle_normalizing_the_plate(): void
    {
        $this->actingAsUser($this->owner)->postJson($this->url(), $this->payload())
            ->assertCreated()
            ->assertJsonPath('data.plate', 'ABC1D23')
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.category', 'B');
    }

    public function test_plate_is_unique_per_organization_only(): void
    {
        $this->actingAsUser($this->owner)->postJson($this->url(), $this->payload())->assertCreated();
        $this->actingAsUser($this->owner)->postJson($this->url(), $this->payload())
            ->assertUnprocessable()->assertJsonValidationErrors('plate');

        $other = $this->organizationWithOwner();
        $this->actingAsUser($other->members()->first())
            ->postJson($this->prefix."/organizations/{$other->getKey()}/vehicles", $this->payload())
            ->assertCreated();
    }

    public function test_category_must_be_simple(): void
    {
        $this->actingAsUser($this->owner)->postJson($this->url(), $this->payload(['category' => 'AB']))
            ->assertUnprocessable()->assertJsonValidationErrors('category');
    }

    public function test_instructor_can_list_but_not_change_vehicles(): void
    {
        $this->vehicleFor($this->org);
        $user = User::factory()->create();
        $this->addMember($this->org, $user, MembershipRole::Instructor);

        $this->actingAsUser($user)->getJson($this->url())->assertOk()->assertJsonCount(1, 'data');
        $this->actingAsUser($user)->postJson($this->url(), $this->payload())->assertForbidden();
    }

    public function test_other_organization_cannot_see_or_touch_vehicle(): void
    {
        $vehicle = $this->vehicleFor($this->org);
        $outsider = $this->organizationWithOwner()->members()->first();

        $this->actingAsUser($outsider)->getJson($this->url("/{$vehicle->getKey()}"))->assertNotFound();

        $otherOrg = $this->organizationWithOwner('cfc', $outsider);
        $this->actingAsUser($outsider)
            ->getJson($this->prefix."/organizations/{$otherOrg->getKey()}/vehicles/{$vehicle->getKey()}")
            ->assertNotFound();
    }

    public function test_update_and_soft_delete(): void
    {
        $vehicle = $this->vehicleFor($this->org);

        $this->actingAsUser($this->owner)->patchJson($this->url("/{$vehicle->getKey()}"), ['status' => 'inactive'])
            ->assertOk()->assertJsonPath('data.status', 'inactive');

        $this->actingAsUser($this->owner)->deleteJson($this->url("/{$vehicle->getKey()}"))->assertNoContent();
        $this->assertSoftDeleted('vehicles', ['id' => $vehicle->getKey()]);
    }
}
