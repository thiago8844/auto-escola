import type { LessonStatus } from './lesson'
import type { ExamStatus } from './exam'

export type ReportPeriod = { from: string; to: string; timezone: string }

export type LessonTotals = { count: number; scheduled_minutes: number; actual_minutes: number; confirmed_minutes: number }

export type LessonGroup = LessonTotals & { key: string | number | null; label: string }

export type LessonGroupBy = 'status' | 'instructor' | 'vehicle' | 'category' | 'partner' | 'day'

export type LessonsReport = { period: ReportPeriod; group_by: LessonGroupBy; totals: LessonTotals; groups: LessonGroup[]; basis: string }

export type LessonDetailRow = {
  id: number
  starts_at: string
  student: string | null
  enrollment_id: number
  category: string | null
  instructor: string | null
  vehicle: string | null
  partner: string | null
  status: LessonStatus
  scheduled_minutes: number
  actual_minutes: number | null
  registry_status: string
}

export type LessonDetail = { data: LessonDetailRow[]; meta: { current_page: number; last_page: number; per_page: number; total: number }; totals: LessonTotals }

export type ApprovalRate = { numerator: number; denominator: number; percent: number | null }

export type ExamRow = {
  category: string | null
  attempt: number | null
  total: number
  scheduled: number
  approved: number
  failed: number
  absent: number
  incomplete: number
  cancelled: number
  result_pending: number
  approval_rate: ApprovalRate
}

export type ExamsReport = { period: ReportPeriod; basis: string; rows: ExamRow[]; totals: ExamRow }

export type ExamDetailRow = { id: number; scheduled_at: string; student: string | null; category: string; attempt: number; status: ExamStatus; location: string | null }

export type ExamDetail = { data: ExamDetailRow[]; meta: { current_page: number; last_page: number; per_page: number; total: number }; totals: ExamRow }

export type ResourceUtilization = {
  id: number
  name: string
  available_minutes: number
  blocked_minutes: number
  used_minutes: number
  utilization: ApprovalRate
}

export type UtilizationReport = { period: ReportPeriod; basis: string; instructors: ResourceUtilization[]; vehicles: ResourceUtilization[] }

export type ProcessesReport = {
  by_status: Array<{ key: string; count: number }>
  by_issuance: Array<{ key: string; count: number }>
  stalled_days: number
  stalled: Array<{ id: number; student: string | null; status: string; last_movement_at: string; days_without_movement: number }>
  documents: { expired: number; expiring: number; window_days: number }
  fees: Array<{ key: string; count: number; amount_cents: number }>
}

export type PartnersReport = {
  period: ReportPeriod
  basis: string
  partners: Array<{ id: number; name: string; students: number; lessons: number; completed_lessons: number; realized_minutes: number; exams: number; approved_exams: number }>
}

export type DashboardStaff = {
  scope: 'staff'
  today: { total: number; scheduled: number; completed: number; missed: number; cancelled: number; date: string }
  week: { total: number; scheduled: number; completed: number; missed: number; cancelled: number; from: string; to: string }
  students_in_service: number
  pending: { open: number; critical: number; high: number }
  low_balance: { count: number; exhausted: number }
  upcoming_exams: Array<{ id: number; student: string | null; category: string; scheduled_at: string; location: string | null }>
  next_lessons: Array<{ id: number; starts_at: string; student: string | null; instructor: string | null; vehicle: string | null }>
}

export type DashboardInstructor = { scope: 'instructor'; today: { total: number; date: string }; week: { total: number }; pending: { open: number } }

export type Dashboard = DashboardStaff | DashboardInstructor

export type StudentSummary = {
  student: { id: number; name: string; phone: string | null }
  enrollments: Array<{
    id: number
    category: string
    status: string
    partner: string | null
    price_cents: number | null
    minutes: { contracted: number; reserved: number; realized: number; consumed: number; available: number }
    lessons: { scheduled: number; completed: number; missed: number; cancelled: number }
  }>
  evolution: Array<{ date: string; text: string }>
  exams: Array<{ category: string; attempt: number; status: ExamStatus; date: string; location: string | null }>
  processes: Array<{ id: number; type: string; status: string; issuance_status: string; next_step: { label?: string; message?: string } | string | null; practice_released: boolean }>
}
