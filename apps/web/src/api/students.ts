import type { StudentInput } from '../schemas/student'
import type { Paginated } from '../types/organization'
import type { Student } from '../types/student'
import { PAGE_SIZE } from '../config/organization'
import { http } from './client'

const handledByScreen = { skipGlobalError: true } as const
const orNull = (value: string) => value.trim() || null

export type StudentListParams = { search: string; page: number }

export async function listStudents(organizationId: number | string, { search, page }: StudentListParams): Promise<Paginated<Student>> {
  const { data } = await http.get<Paginated<Student>>(`/organizations/${organizationId}/students`, {
    params: { per_page: PAGE_SIZE, page, search: search || undefined },
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
  }
}

export async function createStudent(organizationId: number | string, input: StudentInput): Promise<Student> {
  const { data } = await http.post<{ data: Student }>(`/organizations/${organizationId}/students`, toPayload(input), handledByScreen)
  return data.data
}

export async function updateStudent(organizationId: number | string, studentId: number | string, input: StudentInput): Promise<Student> {
  const { data } = await http.patch<{ data: Student }>(`/organizations/${organizationId}/students/${studentId}`, toPayload(input), handledByScreen)
  return data.data
}
