import type { InstructorInput } from '../schemas/instructor'
import type { Instructor } from '../types/instructor'
import type { Lesson } from '../types/lesson'
import type { Paginated } from '../types/organization'
import { http } from './client'
import { fetchAllPages } from './paginate'

const handledByScreen = { skipGlobalError: true } as const

// Agenda pessoal: aulas em que o usuário é o instrutor, em todos os espaços, cada uma uma única vez.
// `from` e `to` são dias no fuso informado.
export type MyLessonsParams = { from: string; to: string; timezone: string }

export async function listMyLessons({ from, to, timezone }: MyLessonsParams): Promise<Paginated<Lesson>> {
  return fetchAllPages(async (page) => {
    const { data } = await http.get<Paginated<Lesson>>('/me/lessons', {
      params: { from, to, timezone, per_page: 100, page },
      ...handledByScreen,
    })
    return data
  })
}

export async function getMyInstructor(): Promise<Instructor> {
  const { data } = await http.get<{ data: Instructor }>('/me/instructor', handledByScreen)
  return data.data
}

function toPayload(input: InstructorInput) {
  return { full_name: input.full_name, credential_number: input.credential_number.trim() || null, categories: input.categories }
}

export async function createMyInstructor(input: InstructorInput): Promise<Instructor> {
  const { data } = await http.post<{ data: Instructor }>('/me/instructor', toPayload(input), handledByScreen)
  return data.data
}

export async function updateMyInstructor(input: InstructorInput): Promise<Instructor> {
  const { data } = await http.patch<{ data: Instructor }>('/me/instructor', toPayload(input), handledByScreen)
  return data.data
}
