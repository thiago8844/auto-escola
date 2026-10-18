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
  enrollments_in_service: number
  upcoming_exams_total: number
  upcoming_exams_period: { from: string; to: string }
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

export type StudentSituation = 'in_progress' | 'prospect' | 'qualified' | 'dropped' | 'registered' | 'archived'
export type StudentAgenda = 'with_lesson' | 'exam_only' | 'finishing' | 'no_schedule'
export type StudentStall = 'practice_blocked' | 'no_package' | 'no_balance' | 'ready_to_schedule'
export type StudentArchive = 'ready' | 'blocked_enrollment' | 'blocked_agenda'
export type StudentBalanceState = 'exhausted' | 'low' | 'ok' | 'none'

export type StudentTotals = {
  count: number
  in_progress: number
  prospect: number
  qualified: number
  dropped: number
  registered: number
  with_lesson: number
  exam_only: number
  finishing: number
  no_schedule: number
  archive_ready: number
  archive_blocked: number
}

export type StudentInstructorRow = {
  id: number | null
  key: string
  name: string
  selected: boolean
  students: number
  in_progress: number
  with_lesson: number
  no_schedule: number
  qualified: number
  archive_ready: number
  share_students: number | null
  share_in_progress: number | null
  share_with_lesson: number | null
}

export type Counted<K extends string = string> = { key: K; count: number }

export type StudentsReport = {
  as_of: string
  timezone: string
  filtered: boolean
  overview: StudentTotals & { archived: number }
  totals: StudentTotals
  share: Record<'students' | 'in_progress' | 'with_lesson' | 'no_schedule' | 'qualified' | 'archive_ready', number | null>
  situations: Counted<StudentSituation>[]
  agenda: Counted<StudentAgenda>[]
  stall: Counted<StudentStall>[]
  archive: Counted<StudentArchive>[]
  idle: Counted<'d7' | 'd15' | 'd30' | 'd60'>[]
  balance: Counted<StudentBalanceState>[]
  exams: { scheduled: number; retry: number }
  categories: Counted[]
  instructors: StudentInstructorRow[]
  partners: Array<{ key: string; name: string; students: number; in_progress: number; with_lesson: number; no_schedule: number; qualified: number }>
  movement: { new: number; qualified: number; archived: number }
  basis: string
}

export type StudentReportRow = {
  id: number
  name: string
  phone: string | null
  situation: StudentSituation
  agenda: StudentAgenda | null
  stall: StudentStall | null
  archive: StudentArchive | null
  categories: string[]
  partner_id: number | null
  partner: string | null
  instructor_id: number | null
  instructor: string | null
  instructor_source: 'assigned' | 'next_lesson' | 'last_lesson' | null
  upcoming_lessons: number
  next_lesson_at: string | null
  last_lesson_at: string | null
  idle_days: number | null
  completed_lessons: number
  missed_lessons: number
  realized_minutes: number
  available_minutes: number | null
  balance_state: StudentBalanceState | null
  next_exam_at: string | null
  exam_retry: boolean
  qualified_at: string | null
  created_at: string
  archived_at: string | null
}

export type StudentsDetail = { data: StudentReportRow[]; meta: { current_page: number; last_page: number; per_page: number; total: number; timezone: string } }
