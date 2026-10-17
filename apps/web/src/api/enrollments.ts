import { LIST_PAGE_SIZE } from '../config/organization'
import type { Enrollment } from '../types/enrollment'
import type { Paginated } from '../types/organization'
import { http } from './client'

export type EnrollmentListParams = { studentId?: number | string; page: number; perPage?: number }

export async function listEnrollments(
  organizationId: number | string,
  { studentId, page, perPage = LIST_PAGE_SIZE }: EnrollmentListParams,
): Promise<Paginated<Enrollment>> {
  const { data } = await http.get<Paginated<Enrollment>>(`/organizations/${organizationId}/enrollments`, {
    params: { per_page: perPage, page, student_id: studentId },
    skipGlobalError: true,
  })
  return data
}
