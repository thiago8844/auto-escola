import { LIST_PAGE_SIZE } from '../config/organization'
import type { EnrollmentInput } from '../schemas/enrollment'
import type { Enrollment, EnrollmentStatus } from '../types/enrollment'
import type { Paginated } from '../types/organization'
import { http } from './client'
import { fetchAllPages } from './paginate'

export type EnrollmentListParams = {
  studentId?: number | string
  page: number
  perPage?: number
  status?: string
  category?: string
  partnerId?: string
  search?: string
}

export async function listEnrollments(
  organizationId: number | string,
  { studentId, page, perPage = LIST_PAGE_SIZE, status, category, partnerId, search }: EnrollmentListParams,
): Promise<Paginated<Enrollment>> {
  const request = async (current: number) => {
    const { data } = await http.get<Paginated<Enrollment>>(`/organizations/${organizationId}/enrollments`, {
      params: {
        per_page: perPage,
        page: current,
        student_id: studentId,
        status: status || undefined,
        category: category || undefined,
        partner_id: partnerId || undefined,
        search: search || undefined,
      },
      skipGlobalError: true,
    })
    return data
  }
  // Lista de um aluno traz todas as matrículas dele; a lista geral é paginada
  return studentId ? fetchAllPages(request) : request(page)
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

export type EnrollmentEdit = { partner_id: number | null; qualification_process_id: number | null; category?: string; notes: string | null }

// Correção por operação explícita: a API recusa o que alteraria histórico (categoria com aulas/saldo/exames) e explica o porquê
export async function updateEnrollment(
  organizationId: number | string,
  enrollmentId: number | string,
  input: EnrollmentEdit,
  expectedUpdatedAt?: string,
): Promise<Enrollment> {
  const { data } = await http.patch<{ data: Enrollment }>(
    `/organizations/${organizationId}/enrollments/${enrollmentId}`,
    { ...input, expected_updated_at: expectedUpdatedAt },
    { skipGlobalError: true },
  )
  return data.data
}
