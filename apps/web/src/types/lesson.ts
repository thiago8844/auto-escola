export type LessonStatus = 'scheduled' | 'completed' | 'missed' | 'cancelled'

export type RegistryStatus = 'not_informed' | 'pending' | 'confirmed' | 'rejected'

export type Lesson = {
  id: number
  status: LessonStatus
  starts_at: string
  ends_at: string
  scheduled_minutes: number
  actual_minutes: number | null
  status_reason: string | null
  notes: string | null
  evolution: string | null
  // Registro do lançamento oficial (feito fora do sistema), separado do status da aula
  registry: { status: RegistryStatus; reference: string | null; document_id: number | null }
  // Só na agenda pessoal (/me/lessons), que mistura espaços
  organization?: { id: number; name: string; type: string }
  vehicle?: { id: number; plate: string; model: string; category: string }
  instructor?: { id: number; full_name: string }
  enrollment?: { id: number; category: string; student?: { id: number; name: string } }
}
