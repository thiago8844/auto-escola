<?php

namespace App\Actions\Processes;

use App\Enums\ProcessType;
use App\Models\Organization;
use App\Models\QualificationProcess;
use App\Services\ChecklistTemplate;
use Illuminate\Support\Facades\DB;

/**
 * Cria o processo e o checklist inicial do tipo escolhido, na mesma transação.
 */
class CreateQualificationProcess
{
    public function __construct(private readonly ChecklistTemplate $template) {}

    /**
     * @param  array<string, mixed>  $data  Já validado (ver QualificationProcessRequest).
     */
    public function __invoke(Organization $organization, array $data): QualificationProcess
    {
        return DB::transaction(function () use ($organization, $data) {
            $process = $organization->qualificationProcesses()->create($data);

            foreach ($this->template->for(ProcessType::from($data['type'])) as $item) {
                $process->checklistItems()->create([
                    'organization_id' => $organization->getKey(),
                    'type' => $item['type'],
                    'required' => $item['required'],
                    'status' => $item['status'],
                ]);
            }

            return $process;
        });
    }
}
