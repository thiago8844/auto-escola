export type AlertPriority = 'low' | 'normal' | 'high' | 'critical'

export type AlertCategory = 'vehicle' | 'document' | 'maintenance' | 'block' | 'lesson' | 'exam' | 'fee' | 'process' | 'balance' | 'student' | 'finance'

export type AlertItem = {
  id: number
  kind: string
  category: AlertCategory
  priority: AlertPriority
  title: string
  message: string | null
  // Registro de origem: o link para a ação é montado a partir dele
  subject: { type: 'vehicle' | 'student' | 'enrollment' | 'exam' | 'lesson' | 'process' | 'instructor' | 'receivable' | 'payable'; id: number } | null
  due_on: string | null
  status: 'open' | 'resolved'
  resolved_at: string | null
  resolved_reason: string | null
  first_seen_at: string
  // Estado do usuário logado (persistido no servidor)
  read_at: string | null
  archived_at: string | null
}

export type AlertCounters = { unread: number; critical_unread: number; open: number }

export type AlertSettings = {
  crlv_lead_days: number
  document_lead_days: number
  exam_lead_days: number
  fee_lead_days: number
  release_lead_days: number
  low_balance_minutes: number
  inactive_days: number
  lesson_grace_hours: number
  staff_receives: boolean
}
