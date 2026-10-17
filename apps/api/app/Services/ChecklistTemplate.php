<?php

namespace App\Services;

use App\Enums\ChecklistItemStatus;
use App\Enums\ChecklistItemType;
use App\Enums\ProcessType;

/**
 * Itens iniciais do checklist por tipo de processo.
 *
 * ATENÇÃO: são padrões do PRODUTO para conferência, não verdade legal. Pontos ainda sem
 * confirmação oficial (V03 e V11 em docs/fluxo-habilitacao-brasil-mg.md) ficam como itens
 * opcionais com situação "unknown". A equipe pode ADICIONAR exigências a um processo, mas
 * dispensar um item exige situação "not_applicable" com motivo registrado.
 */
class ChecklistTemplate
{
    /**
     * @return list<array{type: ChecklistItemType, required: bool, status: ChecklistItemStatus}>
     */
    public function for(ProcessType $type): array
    {
        $required = fn (ChecklistItemType $t) => ['type' => $t, 'required' => true, 'status' => ChecklistItemStatus::Pending];
        $optional = fn (ChecklistItemType $t) => ['type' => $t, 'required' => false, 'status' => ChecklistItemStatus::Unknown];

        return match ($type) {
            // Toxicológico de primeira habilitação em MG é exigido após a aprovação prática,
            // portanto não bloqueia o início das aulas.
            ProcessType::FirstLicense => [
                $required(ChecklistItemType::TheoryCompletion),
                $required(ChecklistItemType::LearningLicense),
                $required(ChecklistItemType::MedicalExam),
                $required(ChecklistItemType::PsychologicalExam),
                $optional(ChecklistItemType::ToxicologicalExam),
            ],
            ProcessType::CategoryAddition => [
                $required(ChecklistItemType::CurrentLicense),
                $required(ChecklistItemType::LearningLicense),
                $required(ChecklistItemType::MedicalExam),
                $optional(ChecklistItemType::PsychologicalExam),
            ],
            ProcessType::CategoryChange => [
                $required(ChecklistItemType::CurrentLicense),
                $required(ChecklistItemType::LearningLicense),
                $required(ChecklistItemType::MedicalExam),
                $required(ChecklistItemType::ToxicologicalExam),
                $optional(ChecklistItemType::PsychologicalExam),
            ],
            // Quem só quer praticar não tem processo de formação: conferir a CNH atual basta.
            ProcessType::Refresher => [
                $required(ChecklistItemType::CurrentLicense),
            ],
        };
    }
}
