<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Processes\CloseProcess;
use App\Actions\Processes\RegisterIssuance;
use App\Actions\Processes\SetCategoryRenunciation;
use App\Enums\LicenseCategory;
use App\Http\Controllers\Controller;
use App\Http\Requests\Processes\CloseProcessRequest;
use App\Http\Requests\Processes\IssuanceRequest;
use App\Http\Requests\Processes\ReasonRequest;
use App\Http\Resources\QualificationProcessResource;
use App\Models\Organization;
use App\Models\QualificationProcess;
use App\Services\ProcessOutcome;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Desfecho do processo: emissão, renúncia por categoria, encerramento e reabertura.
 */
class ProcessOutcomeController extends Controller
{
    private const RELATIONS = ['student', 'checklistItems.checker', 'exams', 'categoryTracks', 'externalFees.exams', 'enrollments'];

    public function closureCheck(Organization $organization, QualificationProcess $qualificationProcess, ProcessOutcome $outcome): JsonResponse
    {
        $this->authorize('outcome', [$qualificationProcess, $organization]);

        return response()->json(['data' => $outcome->closureCheck($qualificationProcess)]);
    }

    public function issuance(IssuanceRequest $request, Organization $organization, QualificationProcess $qualificationProcess, RegisterIssuance $register): JsonResponse
    {
        $this->authorize('outcome', [$qualificationProcess, $organization]);

        return $this->respond($register($qualificationProcess, $request->validated()));
    }

    public function close(CloseProcessRequest $request, Organization $organization, QualificationProcess $qualificationProcess, CloseProcess $close): JsonResponse
    {
        $this->authorize('outcome', [$qualificationProcess, $organization]);

        return $this->respond($close->close($qualificationProcess, $request->validated()));
    }

    public function reopen(ReasonRequest $request, Organization $organization, QualificationProcess $qualificationProcess, CloseProcess $close): JsonResponse
    {
        $this->authorize('reopen', [$qualificationProcess, $organization]);

        return $this->respond($close->reopen($qualificationProcess, $request->validated('reason')));
    }

    public function renounce(Request $request, Organization $organization, QualificationProcess $qualificationProcess, string $category, SetCategoryRenunciation $action): JsonResponse
    {
        $this->authorize('outcome', [$qualificationProcess, $organization]);
        $data = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:255']]);
        $this->assertCategory($category);

        $action->renounce($qualificationProcess, $category, $data['reason']);

        return $this->respond($qualificationProcess);
    }

    public function confirmRenunciation(Request $request, Organization $organization, QualificationProcess $qualificationProcess, string $category, SetCategoryRenunciation $action): JsonResponse
    {
        $this->authorize('outcome', [$qualificationProcess, $organization]);
        $data = $request->validate(['reference' => ['required', 'string', 'min:2', 'max:100']]);
        $this->assertCategory($category);

        $action->confirm($qualificationProcess, $category, $data['reference']);

        return $this->respond($qualificationProcess);
    }

    public function revertRenunciation(ReasonRequest $request, Organization $organization, QualificationProcess $qualificationProcess, string $category, SetCategoryRenunciation $action): JsonResponse
    {
        $this->authorize('outcome', [$qualificationProcess, $organization]);
        $this->assertCategory($category);

        $action->revert($qualificationProcess, $category, $request->validated('reason'));

        return $this->respond($qualificationProcess);
    }

    private function assertCategory(string $category): void
    {
        validator(['category' => $category], ['category' => [Rule::in(LicenseCategory::simpleValues())]])->validate();
    }

    private function respond(QualificationProcess $process): JsonResponse
    {
        return (new QualificationProcessResource($process->refresh()->load(self::RELATIONS)))->response();
    }
}
