import type { StudentDocument } from '../types/document'
import type { Paginated } from '../types/organization'
import { http } from './client'

export async function listStudentDocuments(organizationId: number | string, studentId: number | string): Promise<Paginated<StudentDocument>> {
  const { data } = await http.get<Paginated<StudentDocument>>(`/organizations/${organizationId}/documents`, {
    params: { student_id: studentId, per_page: 100 },
    skipGlobalError: true,
  })
  return data
}
