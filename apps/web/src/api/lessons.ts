import type { Lesson } from '../types/lesson'
import type { Paginated } from '../types/organization'
import { http } from './client'

export async function listLessons(organizationId: number | string, enrollmentId: number | string): Promise<Paginated<Lesson>> {
  const { data } = await http.get<Paginated<Lesson>>(`/organizations/${organizationId}/lessons`, {
    params: { enrollment_id: enrollmentId, per_page: 100 },
    skipGlobalError: true,
  })
  return data
}

// Concluir exige a matrícula liberada para a prática; a API responde com os itens pendentes
export async function completeLesson(organizationId: number | string, lessonId: number): Promise<Lesson> {
  const { data } = await http.patch<{ data: Lesson }>(
    `/organizations/${organizationId}/lessons/${lessonId}/status`,
    { status: 'completed' },
    { skipGlobalError: true },
  )
  return data.data
}
