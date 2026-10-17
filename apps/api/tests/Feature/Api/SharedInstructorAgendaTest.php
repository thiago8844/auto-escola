<?php

namespace Tests\Feature\Api;

use App\Enums\LessonStatus;
use App\Enums\MembershipRole;
use App\Models\Instructor;
use App\Models\Organization;
use App\Models\User;

/**
 * João é instrutor no CFC Alfa, no CFC Beta e tem o próprio espaço particular.
 * A agenda pessoal reúne as três, sem duplicar aulas.
 */
class SharedInstructorAgendaTest extends ApiTestCase
{
    private User $joao;

    private User $carlosBeta;

    private Organization $alfa;

    private Organization $beta;

    private Organization $particular;

    private Instructor $joaoProfile;

    protected function setUp(): void
    {
        parent::setUp();

        $maria = User::factory()->create();
        $this->carlosBeta = User::factory()->create();
        $this->joao = User::factory()->create(['name' => 'João Silva']);

        $this->alfa = $this->organizationWithOwner('cfc', $maria);
        $this->beta = $this->organizationWithOwner('cfc', $this->carlosBeta);
        $this->particular = $this->organizationWithOwner('independent', $this->joao);

        $this->joaoProfile = Instructor::factory()->create(['user_id' => $this->joao->getKey()]);
        $this->particular->instructors()->attach($this->joaoProfile->getKey(), ['active' => true]);

        foreach ([$this->alfa, $this->beta] as $organization) {
            $this->addMember($organization, $this->joao, MembershipRole::Instructor);
            $organization->instructors()->attach($this->joaoProfile->getKey(), ['active' => true]);
        }

        $this->lessonFor($this->alfa, $this->joaoProfile, $this->enrollmentFor($this->alfa), ...$this->window(2, 9));
        $this->lessonFor($this->beta, $this->joaoProfile, $this->enrollmentFor($this->beta), ...$this->window(3, 14));
        $this->lessonFor($this->particular, $this->joaoProfile, $this->enrollmentFor($this->particular), ...$this->window(4, 10));
    }

    public function test_personal_agenda_consolidates_three_spaces_without_duplicates(): void
    {
        $response = $this->actingAsUser($this->joao)->getJson($this->prefix.'/me/lessons')
            ->assertOk()
            ->assertJsonCount(3, 'data');

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertCount(3, $ids->unique());

        $organizationNames = collect($response->json('data'))->pluck('organization.name')->sort()->values()->all();
        $this->assertSame(
            collect([$this->alfa, $this->beta, $this->particular])->pluck('name')->sort()->values()->all(),
            $organizationNames,
        );
    }

    public function test_personal_agenda_filters_by_period(): void
    {
        $day = now()->utc()->addDays(3)->toDateString();

        $this->actingAsUser($this->joao)
            ->getJson($this->prefix."/me/lessons?from={$day}&to={$day}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.organization.id', $this->beta->getKey());
    }

    public function test_revoking_access_removes_lessons_from_personal_agenda(): void
    {
        $this->actingAsUser($this->carlosBeta)
            ->deleteJson($this->prefix."/organizations/{$this->beta->getKey()}/members/{$this->joao->getKey()}")
            ->assertNoContent();

        $this->actingAsUser($this->joao)->getJson($this->prefix.'/me/lessons')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonMissing(['id' => $this->beta->getKey()]);

        // A aula continua existindo no CFC Beta; só deixa de aparecer para João.
        $this->assertDatabaseCount('lessons', 3);
    }

    public function test_personal_agenda_is_empty_without_instructor_profile(): void
    {
        $outsider = User::factory()->create();
        $this->addMember($this->alfa, $outsider, MembershipRole::Staff);

        $this->actingAsUser($outsider)->getJson($this->prefix.'/me/lessons')
            ->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_instructor_in_organization_sees_only_own_lessons_even_when_filtering_by_colleague(): void
    {
        $colleague = $this->linkInstructor($this->alfa);
        $this->lessonFor($this->alfa, $colleague, $this->enrollmentFor($this->alfa), ...$this->window(5, 8));

        $this->actingAsUser($this->joao)
            ->getJson($this->prefix."/organizations/{$this->alfa->getKey()}/lessons")
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $this->actingAsUser($this->joao)
            ->getJson($this->prefix."/organizations/{$this->alfa->getKey()}/lessons?instructor_id={$colleague->getKey()}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.instructor.id', $this->joaoProfile->getKey());
    }

    public function test_cfc_staff_does_not_see_lessons_of_other_organizations(): void
    {
        $this->actingAsUser($this->carlosBeta)
            ->getJson($this->prefix."/organizations/{$this->alfa->getKey()}/lessons")
            ->assertNotFound();

        $this->actingAsUser($this->carlosBeta)
            ->getJson($this->prefix."/organizations/{$this->beta->getKey()}/lessons")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.status', LessonStatus::Scheduled->value);
    }
}
