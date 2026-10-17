<?php

namespace App\Enums;

/**
 * Tipos de documento suportados. A lista define o que o sistema sabe guardar,
 * não uma coleta obrigatória (ver seção 16 do fluxo).
 */
enum DocumentType: string
{
    case Identity = 'identity';
    case CurrentLicense = 'current_license';
    case ProofOfResidence = 'proof_of_residence';
    case ProcessProtocol = 'process_protocol';
    case LearningLicense = 'learning_license';
    case TheoryCompletion = 'theory_completion';
    case AssessmentResult = 'assessment_result';
    case PaymentGuide = 'payment_guide';
    case PaymentProof = 'payment_proof';
    case ExamScheduling = 'exam_scheduling';
    case ExamResult = 'exam_result';
    case Contract = 'contract';
    case Receipt = 'receipt';
    case OfficialRequest = 'official_request';
    case VehicleRegistration = 'vehicle_registration';
    case OfficialLessonRecord = 'official_lesson_record';
    case Other = 'other';
}
