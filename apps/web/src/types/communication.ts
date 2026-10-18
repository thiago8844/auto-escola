export type LessonCommunication = {
  id: number
  organization_id: number
  lesson_id: number
  student_id: number
  channel: 'email' | 'whatsapp_manual'
  purpose: 'lesson_confirmation'
  recipient: string
  subject: string | null
  body: string
  status: 'sending' | 'sent' | 'failed' | 'opened' | 'marked_sent'
  opened_at: string | null
  sent_at: string | null
  marked_sent_at: string | null
  created_at: string
  actor?: { id: number; name: string } | null
}

export type LessonCommunicationPreview = {
  subject: string
  body: string
  student_name: string
  email: string | null
  phone: string | null
  can_email: boolean
  can_whatsapp: boolean
}
