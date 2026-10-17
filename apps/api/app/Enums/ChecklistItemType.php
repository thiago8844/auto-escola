<?php

namespace App\Enums;

/**
 * Pré-requisitos acompanhados antes da prática. O sistema só guarda a situação
 * operacional; não interpreta laudos nem decide aptidão.
 */
enum ChecklistItemType: string
{
    case CurrentLicense = 'current_license';
    case TheoryCompletion = 'theory_completion';
    case LearningLicense = 'learning_license';
    case MedicalExam = 'medical_exam';
    case PsychologicalExam = 'psychological_exam';
    case ToxicologicalExam = 'toxicological_exam';

    public function label(): string
    {
        return match ($this) {
            self::CurrentLicense => 'CNH atual',
            self::TheoryCompletion => 'aprovação teórica',
            self::LearningLicense => 'licença de aprendizagem',
            self::MedicalExam => 'avaliação médica',
            self::PsychologicalExam => 'avaliação psicológica',
            self::ToxicologicalExam => 'exame toxicológico',
        };
    }
}
