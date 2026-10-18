import { LIST_PAGE_SIZE } from '../config/organization'
import type { EnrollmentInput } from '../schemas/enrollment'
import type { Enrollment, EnrollmentStatus } from '../types/enrollment'
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

export async function getEnrollment(organizationId: number | string, enrollmentId: number | string): Promise<Enrollment> {
  const { data } = await http.get<{ data: Enrollment }>(`/organizations/${organizationId}/enrollments/${enrollmentId}`, {
    skipGlobalError: true,
  })
  return data.data
}

export async function createEnrollment(organizationId: number | string, studentId: number, input: EnrollmentInput): Promise<Enrollment> {
  const { data } = await http.post<{ data: Enrollment }>(
    `/organizations/${organizationId}/enrollments`,
    {
      student_id: studentId,
      category: input.category,
      status: input.status,
      contracted_minutes: input.contracted_minutes ? Number(input.contracted_minutes) : null,
      price_cents: input.price ? Math.round(Number(input.price) * 100) : null,
      qualification_process_id: input.qualification_process_id ? Number(input.qualification_process_id) : null,
      partner_id: input.partner_id ? Number(input.partner_id) : null,
      notes: input.notes || null,
    },
    { skipGlobalError: true },
  )
  return data.data
}

export async function updateEnrollmentStatus(
  organizationId: number | string,
  enrollmentId: number | string,
  status: EnrollmentStatus,
): Promise<Enrollment> {
  const { data } = await http.patch<{ data: Enrollment }>(`/organizations/${organizationId}/enrollments/${enrollmentId}`, { status })
  return data.data
}
