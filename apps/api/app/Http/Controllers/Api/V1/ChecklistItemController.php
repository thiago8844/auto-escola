<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Processes\UpdateChecklistItem;
use App\Enums\ChecklistItemStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Processes\ChecklistItemRequest;
use App\Http\Resources\ChecklistItemResource;
use App\Models\Organization;
use App\Models\ProcessChecklistItem;
use App\Models\QualificationProcess;
use Illuminate\Http\JsonResponse;

class ChecklistItemController extends Controller
{
    /**
     * Acrescenta uma exigência ao processo. Sempre obrigatória.
     */
    public function store(
        ChecklistItemRequest $request,
        Organization $organization,
        QualificationProcess $qualificationProcess,
        UpdateChecklistItem $update,
    ): JsonResponse {
        $this->authorize('update', [$qualificationProcess, $organization]);

        $item = $qualificationProcess->checklistItems()->make([
            'organization_id' => $organization->getKey(),
            'type' => $request->validated('type'),
            'required' => true,
            'status' => ChecklistItemStatus::Pending,
        ]);

        $item = $update($item, $request->user(), collect($request->validated())->except('type')->all());

        return (new ChecklistItemResource($item->load('checker')))->response()->setStatusCode(201);
    }

    public function update(
        ChecklistItemRequest $request,
        Organization $organization,
        QualificationProcess $qualificationProcess,
        ProcessChecklistItem $checklistItem,
        UpdateChecklistItem $update,
    ): JsonResponse {
        $this->authorize('update', [$qualificationProcess, $organization]);

        $item = $update($checklistItem, $request->user(), $request->validated());

        return (new ChecklistItemResource($item->load('checker')))->response();
    }
}
