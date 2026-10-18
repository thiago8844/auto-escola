import { http } from './client'
import type { Enrollment } from '../types/enrollment'

export async function assignEnrollment(organizationId: number, enrollment: Enrollment, instructorId: number | null) {
  const { data } = await http.put<{ data: Enrollment }>(`/organizations/${organizationId}/enrollments/${enrollment.id}/assignment`, {
    instructor_id: instructorId,
    expected_instructor_id: enrollment.assignment?.instructor_id ?? null,
  }, { skipGlobalError: true })
  return data.data
}
