import type { LessonCommunication, LessonCommunicationPreview } from '../types/communication'
import { http } from './client'

const lessonBase = (organizationId: number, lessonId: number) => `/organizations/${organizationId}/lessons/${lessonId}/communications`
const handledByScreen = { skipGlobalError: true } as const

export async function getLessonCommunicationPreview(organizationId: number, lessonId: number): Promise<LessonCommunicationPreview> {
  const { data } = await http.get<{ data: LessonCommunicationPreview }>(`${lessonBase(organizationId, lessonId)}/preview`, handledByScreen)
  return data.data
}

export async function listLessonCommunications(organizationId: number, lessonId: number): Promise<LessonCommunication[]> {
  const { data } = await http.get<{ data: LessonCommunication[] }>(lessonBase(organizationId, lessonId), handledByScreen)
  return data.data
}

export async function listStudentCommunications(organizationId: number, studentId: number): Promise<LessonCommunication[]> {
  const { data } = await http.get<{ data: LessonCommunication[] }>(`/organizations/${organizationId}/students/${studentId}/communications`, handledByScreen)
  return data.data
}

export async function sendLessonEmail(organizationId: number, lessonId: number): Promise<LessonCommunication> {
  const { data } = await http.post<{ data: LessonCommunication }>(`${lessonBase(organizationId, lessonId)}/email`, {}, handledByScreen)
  return data.data
}

export async function openLessonWhatsApp(organizationId: number, lessonId: number): Promise<{ communication: LessonCommunication; url: string }> {
  const { data } = await http.post<{ data: LessonCommunication; url: string }>(`${lessonBase(organizationId, lessonId)}/whatsapp`, {}, handledByScreen)
  return { communication: data.data, url: data.url }
}

export async function markLessonWhatsAppSent(organizationId: number, lessonId: number, communicationId: number): Promise<LessonCommunication> {
  const { data } = await http.post<{ data: LessonCommunication }>(`${lessonBase(organizationId, lessonId)}/${communicationId}/mark-sent`, {}, handledByScreen)
  return data.data
}
