import type { ChecklistItemType, LicenseCategory, PracticeRelease } from './enrollment'
import type { ProcessOutcome } from './outcome'
import type { Student } from './student'

export type ProcessType = 'first_license' | 'category_addition' | 'category_change' | 'refresher'

export type ProcessStatus = 'preparing' | 'active' | 'pending' | 'awaiting_issuance' | 'completed' | 'closed'

export type ChecklistItemStatus = 'unknown' | 'pending' | 'in_progress' | 'done' | 'verified' | 'not_applicable' | 'blocked'

export type ChecklistSource = 'student_declared' | 'document' | 'official_system' | 'imported'

export type ChecklistItem = {
  id: number
  type: ChecklistItemType
  required: boolean
  status: ChecklistItemStatus
  source: ChecklistSource | null
  reference: string | null
  notes: string | null
  occurred_on: string | null
  document_id: number | null
  checked_by?: { id: number; name: string }
  checked_at: string | null
}

export type QualificationProcess = {
  id: number
  type: ProcessType
  status: ProcessStatus
  uf: string
  municipality: string | null
  renach: string | null
  protocol: string | null
  opened_at: string | null
  current_categories: LicenseCategory[]
  target_categories: LicenseCategory[]
  notes: string | null
  student?: Student
  practice_release?: PracticeRelease
  checklist?: ChecklistItem[]
  // Desfecho: resultado por categoria, emissão e próximo passo (detalhe do processo)
  outcome?: ProcessOutcome
  created_at: string
}
