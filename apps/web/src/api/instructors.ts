import { LIST_PAGE_SIZE, PAGE_SIZE } from '../config/organization'
import type { InstructorInput } from '../schemas/instructor'
import type { Instructor } from '../types/instructor'
import type { Paginated } from '../types/organization'
import { http } from './client'

const handledByScreen = { skipGlobalError: true } as const
const base = (organizationId: number | string) => `/organizations/${organizationId}/instructors`

export type InstructorListParams = { page: number; active?: boolean; all?: boolean }

export async function listInstructors(organizationId: number | string, { page, active, all }: InstructorListParams): Promise<Paginated<Instructor>> {
  const { data } = await http.get<Paginated<Instructor>>(base(organizationId), {
    // `all` serve às listas de escolha (ex.: agendamento): traz até 100 de uma vez
    params: { per_page: all ? LIST_PAGE_SIZE : PAGE_SIZE, page, active: active === undefined ? undefined : active ? 1 : 0 },
    ...handledByScreen,
  })
  return data
}

export async function getInstructor(organizationId: number | string, instructorId: number | string): Promise<Instructor> {
  const { data } = await http.get<{ data: Instructor }>(`${base(organizationId)}/${instructorId}`, handledByScreen)
  return data.data
}

function toPayload(input: InstructorInput) {
  return { full_name: input.full_name, credential_number: input.credential_number.trim() || null, categories: input.categories }
}

export async function createInstructor(organizationId: number | string, input: InstructorInput): Promise<Instructor> {
  const { data } = await http.post<{ data: Instructor }>(base(organizationId), toPayload(input), handledByScreen)
  return data.data
}

export async function updateInstructor(organizationId: number | string, instructorId: number | string, input: InstructorInput): Promise<Instructor> {
  const { data } = await http.patch<{ data: Instructor }>(`${base(organizationId)}/${instructorId}`, toPayload(input), handledByScreen)
  return data.data
}

// Ativa ou desativa só o vínculo com o espaço; aulas já agendadas continuam
export async function setInstructorLink(organizationId: number | string, instructorId: number | string, active: boolean): Promise<Instructor> {
  const { data } = await http.patch<{ data: Instructor }>(`${base(organizationId)}/${instructorId}/link`, { active })
  return data.data
}
