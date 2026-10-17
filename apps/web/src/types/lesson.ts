export type LessonStatus = 'scheduled' | 'completed' | 'missed' | 'cancelled'

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
  vehicle?: { id: number; plate: string; model: string; category: string }
  instructor?: { id: number; full_name: string }
  enrollment?: { id: number; category: string; student?: { id: number; name: string } }
}
