import type { DocumentStatus, DocumentType } from '../types/document'
import type { ChecklistItemType, EnrollmentStatus, LicenseCategory } from '../types/enrollment'
import type { ExamStatus, FeeParty, FeeStatus } from '../types/exam'
import type { LessonStatus, RegistryStatus } from '../types/lesson'
import type { CategoryResult, IssuanceStatus } from '../types/outcome'
import type { VehicleStatus } from '../types/vehicle'
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
  pending: { label: 'Com notificação', bg: 'warning' },
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

// Veículo tem categoria simples: uma matrícula AB usa um veículo A ou B
export const VEHICLE_CATEGORIES = ['A', 'B', 'C', 'D', 'E', 'ACC'] as const

export const VEHICLE_STATUS: Record<VehicleStatus, { label: string; bg: string; icon: string }> = {
  active: { label: 'Ativo', bg: 'success', icon: 'bi-check-circle-fill' },
  inactive: { label: 'Inativo', bg: 'secondary', icon: 'bi-pause-circle' },
}

export const REGISTRY_STATUS: Record<RegistryStatus, { label: string; bg: string }> = {
  not_informed: { label: 'Não informado', bg: 'secondary' },
  pending: { label: 'Pendente', bg: 'warning' },
  confirmed: { label: 'Confirmado', bg: 'success' },
  rejected: { label: 'Rejeitado', bg: 'danger' },
}

// Ausência não é reprovação: cada situação tem rótulo e cor próprios
export const EXAM_STATUS: Record<ExamStatus, { label: string; bg: string; icon: string }> = {
  scheduled: { label: 'Agendado', bg: 'info', icon: 'bi-calendar-event' },
  approved: { label: 'Aprovado', bg: 'success', icon: 'bi-patch-check-fill' },
  failed: { label: 'Reprovado', bg: 'danger', icon: 'bi-x-octagon' },
  absent: { label: 'Ausente', bg: 'warning', icon: 'bi-person-x' },
  incomplete: { label: 'Não concluído', bg: 'warning', icon: 'bi-hourglass-bottom' },
  cancelled: { label: 'Cancelado', bg: 'secondary', icon: 'bi-x-circle' },
}

export const FEE_STATUS: Record<FeeStatus, { label: string; bg: string; icon: string }> = {
  unknown: { label: 'Situação desconhecida', bg: 'secondary', icon: 'bi-question-circle' },
  pending: { label: 'Pendente', bg: 'warning', icon: 'bi-hourglass-split' },
  payment_reported: { label: 'Pagamento informado', bg: 'info', icon: 'bi-receipt' },
  confirmed: { label: 'Pagamento confirmado', bg: 'success', icon: 'bi-patch-check-fill' },
  waived: { label: 'Isenta', bg: 'secondary', icon: 'bi-dash-circle' },
  cancelled: { label: 'Cancelada', bg: 'secondary', icon: 'bi-x-circle' },
}

export const FEE_PARTY_LABELS: Record<FeeParty, string> = {
  student: 'Aluno',
  partner: 'CFC parceiro',
  organization: 'Este espaço',
  other: 'Outra pessoa',
}

export const REIMBURSEMENT_LABELS = { none: 'Sem reembolso', to_settle: 'Reembolso a acertar', settled: 'Reembolso acertado' } as const

export const CATEGORY_RESULT: Record<CategoryResult, { label: string; bg: string; icon: string }> = {
  pending: { label: 'Exame por agendar', bg: 'secondary', icon: 'bi-hourglass' },
  scheduled: { label: 'Exame agendado', bg: 'info', icon: 'bi-calendar-event' },
  approved: { label: 'Aprovado', bg: 'success', icon: 'bi-patch-check-fill' },
  failed: { label: 'Reprovado', bg: 'danger', icon: 'bi-x-octagon' },
  absent: { label: 'Ausente na última tentativa', bg: 'warning', icon: 'bi-person-x' },
  incomplete: { label: 'Não concluído', bg: 'warning', icon: 'bi-hourglass-bottom' },
  renounced: { label: 'Renunciada', bg: 'secondary', icon: 'bi-slash-circle' },
}

export const ISSUANCE_STATUS: Record<IssuanceStatus, { label: string; bg: string; icon: string }> = {
  not_started: { label: 'Não iniciada', bg: 'secondary', icon: 'bi-dash-circle' },
  pending: { label: 'Emissão pendente', bg: 'warning', icon: 'bi-hourglass-split' },
  issued: { label: 'Emitido', bg: 'info', icon: 'bi-file-earmark-check' },
  delivered: { label: 'Entregue ao aluno', bg: 'success', icon: 'bi-box2-heart' },
}

export const ISSUANCE_KIND_LABELS = { ppd: 'PPD (Permissão para Dirigir)', cnh: 'CNH definitiva' } as const

export const CLOSURE_KIND_LABELS = { completed: 'Concluído', abandoned: 'Desistência', other: 'Encerrado' } as const

// Categorias da linha do tempo e da auditoria
export const AUDIT_CATEGORIES: Record<string, { label: string; icon: string }> = {
  access: { label: 'Acesso', icon: 'bi-shield-lock' },
  balance: { label: 'Saldo de aulas', icon: 'bi-hourglass-split' },
  lesson: { label: 'Aulas', icon: 'bi-calendar-check' },
  exam: { label: 'Exames', icon: 'bi-clipboard-check' },
  fee: { label: 'Taxas externas', icon: 'bi-receipt' },
  process: { label: 'Processo', icon: 'bi-diagram-3' },
  enrollment: { label: 'Matrícula', icon: 'bi-journal-text' },
  document: { label: 'Documentos', icon: 'bi-file-earmark-text' },
  finance: { label: 'Financeiro', icon: 'bi-cash-coin' },
  availability: { label: 'Disponibilidade', icon: 'bi-slash-circle' },
  maintenance: { label: 'Manutenção', icon: 'bi-wrench-adjustable' },
  report: { label: 'Relatórios', icon: 'bi-bar-chart-line' },
  student: { label: 'Alunos', icon: 'bi-mortarboard' },
  vehicle: { label: 'Veículos', icon: 'bi-car-front' },
  partner: { label: 'Parceiros', icon: 'bi-building' },
}
