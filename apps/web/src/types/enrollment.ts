import type { Balance } from './balance'
import type { Student } from './student'

export type LicenseCategory = 'A' | 'AB' | 'AC' | 'AD' | 'AE' | 'B' | 'C' | 'D' | 'E' | 'ACC'

export type EnrollmentStatus = 'prospect' | 'contracted' | 'in_service' | 'closed' | 'terminated'

export type ChecklistItemType =
  | 'current_license'
  | 'theory_completion'
  | 'learning_license'
  | 'medical_exam'
  | 'psychological_exam'
  | 'toxicological_exam'

// Só os tipos pendentes (sem laudos nem notas); aparece quando a matrícula tem processo
export type PracticeRelease = {
  released: boolean
  pending: ChecklistItemType[]
}

export type Enrollment = {
  id: number
  category: LicenseCategory
  status: EnrollmentStatus
  contracted_minutes: number | null
  // Saldo calculado pela API sobre todos os movimentos; só a equipe vê
  balance?: Balance
  // Preço e observações só vêm para a equipe
  price_cents?: number | null
  notes?: string | null
  qualification_process_id: number | null
  practice_release?: PracticeRelease
  student?: Pick<Student, 'id' | 'name' | 'phone'>
  partner?: { id: number; name: string }
  created_at: string
  updated_at?: string
}
