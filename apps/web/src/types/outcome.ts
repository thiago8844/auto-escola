export type IssuanceStatus = 'not_started' | 'pending' | 'issued' | 'delivered'

export type CategoryResult = 'pending' | 'scheduled' | 'approved' | 'failed' | 'absent' | 'incomplete' | 'renounced'

export type CategoryOutcome = {
  category: string
  result: CategoryResult
  attempts: number
  last_exam_id: number | null
  renunciation: { renounced_at: string | null; reason: string | null; confirmed_at: string | null; reference: string | null }
}

export type ProcessOutcome = {
  practice_release: { released: boolean; pending_count: number }
  categories: CategoryOutcome[]
  issuance: {
    status: IssuanceStatus
    kind: 'ppd' | 'cnh' | null
    reference: string | null
    issued_at: string | null
    delivered_at: string | null
    document_id: number | null
    awaiting: boolean
    definitive_follow_up: boolean
    definitive_due_at: string | null
  }
  closure: { kind: string | null; reason: string | null; closed_at: string | null }
  all_categories_resolved: boolean
  next_step: { code: string; label: string }
}

export type ClosureCheck = {
  can_complete: boolean
  future_lessons: number
  future_exams: number
  pending: Array<{ code: string; count: number; message: string }>
}

export type AuditEvent = {
  id: number
  event: string
  category: string
  summary: string
  reason: string | null
  changes: Record<string, unknown> | null
  student_id: number | null
  qualification_process_id: number | null
  enrollment_id: number | null
  actor?: { id: number; name: string } | null
  created_at: string
}
