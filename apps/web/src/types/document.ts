export type DocumentStatus = 'attached' | 'verified' | 'rejected' | 'replaced'

export type DocumentType =
  | 'identity'
  | 'current_license'
  | 'proof_of_residence'
  | 'process_protocol'
  | 'learning_license'
  | 'theory_completion'
  | 'assessment_result'
  | 'payment_guide'
  | 'payment_proof'
  | 'exam_scheduling'
  | 'exam_result'
  | 'contract'
  | 'receipt'
  | 'official_request'
  | 'vehicle_registration'
  | 'official_lesson_record'
  | 'other'

export type StudentDocument = {
  id: number
  type: DocumentType
  status: DocumentStatus
  student_id: number | null
  qualification_process_id: number | null
  practical_exam_id?: number | null
  version: number
  issuer: string | null
  issued_at: string | null
  expires_at: string | null
  original_name: string
  created_at: string
}
