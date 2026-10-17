import type { DocumentStatus, DocumentType } from '../types/document'
import type { EnrollmentStatus, LicenseCategory } from '../types/enrollment'
import type { LessonStatus } from '../types/lesson'

export const LICENSE_CATEGORIES: LicenseCategory[] = ['A', 'AB', 'AC', 'AD', 'AE', 'B', 'C', 'D', 'E', 'ACC']

// Cor sempre acompanhada de texto (e ícone onde couber)
export const ENROLLMENT_STATUS: Record<EnrollmentStatus, { label: string; bg: string }> = {
  prospect: { label: 'Interessado', bg: 'secondary' },
  contracted: { label: 'Contratada', bg: 'primary' },
  in_service: { label: 'Em atendimento', bg: 'info' },
  closed: { label: 'Encerrada', bg: 'secondary' },
  terminated: { label: 'Rescindida', bg: 'danger' },
}

export const LESSON_STATUS: Record<LessonStatus, { label: string; bg: string; icon: string }> = {
  scheduled: { label: 'Agendada', bg: 'info', icon: 'bi-calendar-event' },
  completed: { label: 'Realizada', bg: 'success', icon: 'bi-check-circle-fill' },
  missed: { label: 'Falta', bg: 'warning', icon: 'bi-person-x' },
  cancelled: { label: 'Cancelada', bg: 'secondary', icon: 'bi-x-circle' },
}

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  identity: 'Documento de identidade',
  current_license: 'CNH atual',
  proof_of_residence: 'Comprovante de residência',
  process_protocol: 'Protocolo do processo',
  learning_license: 'Licença de aprendizagem (LADV)',
  theory_completion: 'Conclusão do curso teórico',
  assessment_result: 'Resultado de avaliação',
  payment_guide: 'Guia de pagamento',
  payment_proof: 'Comprovante de pagamento',
  exam_scheduling: 'Agendamento de exame',
  exam_result: 'Resultado de exame',
  contract: 'Contrato',
  receipt: 'Recibo',
  official_request: 'Requerimento oficial',
  vehicle_registration: 'CRLV do veículo',
  official_lesson_record: 'Registro oficial de aula',
  other: 'Outro',
}

export const DOCUMENT_STATUS: Record<DocumentStatus, { label: string; bg: string }> = {
  attached: { label: 'Anexado', bg: 'secondary' },
  verified: { label: 'Conferido', bg: 'success' },
  rejected: { label: 'Rejeitado', bg: 'danger' },
  replaced: { label: 'Substituído', bg: 'secondary' },
}
