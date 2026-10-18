export type ExamStatus = 'scheduled' | 'cancelled' | 'approved' | 'failed' | 'absent' | 'incomplete'

export type FeeStatus = 'unknown' | 'pending' | 'payment_reported' | 'confirmed' | 'waived' | 'cancelled'

export type FeeParty = 'student' | 'partner' | 'organization' | 'other'

export type ExamScheduleChange = {
  scheduled_at: string
  duration_minutes: number
  location: string | null
  instructor_id: number | null
  vehicle_id: number | null
  changed_at: string
  reason: string | null
}

export type ExamPending = { code: string; message: string }

// O instrutor responsável recebe só o resumo; os campos da equipe ficam ausentes
export type Exam = {
  id: number
  category: string
  attempt_number: number
  status: ExamStatus
  scheduled_at: string
  ends_at: string
  duration_minutes: number
  location: string | null
  student?: { id: number; name: string }
  vehicle?: { id: number; plate: string; model: string } | null
  instructor?: { id: number; full_name: string } | null
  qualification_process_id?: number
  student_id?: number
  enrollment_id?: number | null
  protocol?: string | null
  notes?: string | null
  status_reason?: string | null
  result_at?: string | null
  reschedule_count?: number
  schedule_history?: ExamScheduleChange[]
  pending?: ExamPending[]
  fees?: ExternalFee[]
  created_at?: string
}

export type ExternalFee = {
  id: number
  qualification_process_id: number
  student_id: number
  kind: string
  voucher_number: string | null
  amount_cents: number | null
  issued_at: string | null
  due_date: string | null
  reference: string | null
  status: FeeStatus
  is_open: boolean
  status_reason: string | null
  obligor: FeeParty
  paid_by: FeeParty | null
  reimbursement: 'none' | 'to_settle' | 'settled'
  cash_effect: 'none'
  confirmation_source: string | null
  confirmed_at: string | null
  confirmed_by?: { id: number; name: string } | null
  receipt_document_id: number | null
  notes: string | null
  exam_ids?: number[]
  student?: { id: number; name: string }
}
