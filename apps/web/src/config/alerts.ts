import type { AlertCategory, AlertPriority } from '../types/alert'
import type { NoticeType } from '../types/notice'

// Prioridade da pendência -> aparência do aviso (cor sempre com ícone e texto)
export const PRIORITY_NOTICE: Record<AlertPriority, NoticeType> = { critical: 'error', high: 'warning', normal: 'info', low: 'reminder' }
export const PRIORITY_LABEL: Record<AlertPriority, string> = { critical: 'Urgente', high: 'Importante', normal: 'Normal', low: 'Baixa' }

export const ALERT_CATEGORIES: Record<AlertCategory, { label: string; icon: string }> = {
  vehicle: { label: 'Veículos', icon: 'bi-car-front' },
  document: { label: 'Documentos', icon: 'bi-file-earmark-text' },
  maintenance: { label: 'Manutenção', icon: 'bi-wrench-adjustable' },
  block: { label: 'Bloqueios', icon: 'bi-slash-circle' },
  lesson: { label: 'Aulas', icon: 'bi-calendar-check' },
  exam: { label: 'Exames', icon: 'bi-clipboard-check' },
  fee: { label: 'Taxas', icon: 'bi-receipt' },
  process: { label: 'Processos', icon: 'bi-diagram-3' },
  balance: { label: 'Saldo de aulas', icon: 'bi-hourglass-split' },
  student: { label: 'Alunos', icon: 'bi-mortarboard' },
  finance: { label: 'Financeiro', icon: 'bi-cash-coin' },
}
