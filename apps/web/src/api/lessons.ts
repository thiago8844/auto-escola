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
