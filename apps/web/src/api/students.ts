import type { StudentInput } from '../schemas/student'
import type { Paginated } from '../types/organization'
import type { Student } from '../types/student'
import { PAGE_SIZE } from '../config/organization'
import { http } from './client'

const handledByScreen = { skipGlobalError: true } as const
const orNull = (value: string) => value.trim() || null

export type StudentListParams = { search: string; page: number; archived?: boolean }

export async function listStudents(organizationId: number | string, { search, page, archived }: StudentListParams): Promise<Paginated<Student>> {
  const { data } = await http.get<Paginated<Student>>(`/organizations/${organizationId}/students`, {
    params: { per_page: PAGE_SIZE, page, search: search || undefined, archived: archived ? 1 : undefined },
    ...handledByScreen,
  })
  return data
}

export async function getStudent(organizationId: number | string, studentId: number | string): Promise<Student> {
  const { data } = await http.get<{ data: Student }>(`/organizations/${organizationId}/students/${studentId}`, handledByScreen)
  return data.data
}

function toPayload(input: StudentInput) {
  return {
    name: input.name,
    cpf: orNull(input.cpf),
    email: orNull(input.email),
    phone: orNull(input.phone),
    birth_date: orNull(input.birth_date),
    identity_number: orNull(input.identity_number),
    identity_issuer: orNull(input.identity_issuer),
    partner_id: input.partner_id === 'space' ? null : Number(input.partner_id),
  }
}

export async function createStudent(organizationId: number | string, input: StudentInput): Promise<Student> {
  const { data } = await http.post<{ data: Student }>(`/organizations/${organizationId}/students`, toPayload(input), handledByScreen)
  return data.data
}

export async function updateStudent(organizationId: number | string, studentId: number | string, input: StudentInput, expectedUpdatedAt?: string): Promise<Student> {
  const { data } = await http.patch<{ data: Student }>(`/organizations/${organizationId}/students/${studentId}`, { ...toPayload(input), expected_updated_at: expectedUpdatedAt }, handledByScreen)
  return data.data
}
