import type { DocumentStatus, DocumentType } from '../types/document'
import type { ChecklistItemType, EnrollmentStatus, LicenseCategory } from '../types/enrollment'
import type { LessonStatus } from '../types/lesson'
import type { ChecklistItemStatus, ChecklistSource, ProcessStatus, ProcessType } from '../types/process'

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

export const PROCESS_TYPE_LABELS: Record<ProcessType, string> = {
  first_license: 'Primeira habilitação',
  category_addition: 'Adição de categoria',
  category_change: 'Mudança de categoria',
  refresher: 'Aperfeiçoamento',
}

// Situação do acompanhamento local, não do órgão oficial
export const PROCESS_STATUS: Record<ProcessStatus, { label: string; bg: string }> = {
  preparing: { label: 'Em preparação', bg: 'secondary' },
  active: { label: 'Em andamento', bg: 'primary' },
  pending: { label: 'Com pendência', bg: 'warning' },
  awaiting_issuance: { label: 'Aguardando emissão', bg: 'info' },
  completed: { label: 'Concluído', bg: 'success' },
  closed: { label: 'Encerrado', bg: 'secondary' },
}

export const CHECKLIST_TYPE_LABELS: Record<ChecklistItemType, string> = {
  current_license: 'CNH atual',
  theory_completion: 'Curso teórico concluído',
  learning_license: 'Licença de aprendizagem (LADV)',
  medical_exam: 'Exame médico',
  psychological_exam: 'Avaliação psicológica',
  toxicological_exam: 'Exame toxicológico',
}

// Só "Conferido" e "Não se aplica" liberam a prática
export const CHECKLIST_STATUS: Record<ChecklistItemStatus, { label: string; bg: string; icon: string; releases: boolean }> = {
  unknown: { label: 'Não informado', bg: 'secondary', icon: 'bi-question-circle', releases: false },
  pending: { label: 'Pendente', bg: 'warning', icon: 'bi-hourglass-split', releases: false },
  in_progress: { label: 'Em andamento', bg: 'info', icon: 'bi-arrow-repeat', releases: false },
  done: { label: 'Realizado (sem conferência)', bg: 'info', icon: 'bi-check-circle', releases: false },
  verified: { label: 'Conferido', bg: 'success', icon: 'bi-patch-check-fill', releases: true },
  not_applicable: { label: 'Não se aplica', bg: 'secondary', icon: 'bi-dash-circle', releases: true },
  blocked: { label: 'Bloqueado', bg: 'danger', icon: 'bi-slash-circle', releases: false },
}

export const CHECKLIST_SOURCE_LABELS: Record<ChecklistSource, string> = {
  student_declared: 'Declarado pelo aluno',
  document: 'Documento',
  official_system: 'Sistema oficial',
  imported: 'Importado',
}

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const
