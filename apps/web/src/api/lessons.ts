import type { LessonNotesInput, LessonStatusInput, RegistryInput, RescheduleInput, ScheduleInput } from '../schemas/lesson'
import type { Lesson, LessonStatus } from '../types/lesson'
import type { Paginated } from '../types/organization'
import { zonedTimeToIso } from '../utils/timezone'
import { http } from './client'

const base = (organizationId: number | string) => `/organizations/${organizationId}/lessons`
const handledByScreen = { skipGlobalError: true } as const
const orNull = (value: string) => value.trim() || null

// Matrícula: usada no histórico do aluno e no detalhe da matrícula
export async function listLessons(organizationId: number | string, enrollmentId: number | string): Promise<Paginated<Lesson>> {
  const { data } = await http.get<Paginated<Lesson>>(base(organizationId), {
    params: { enrollment_id: enrollmentId, per_page: 100 },
    ...handledByScreen,
  })
  return data
}

// `from` e `to` são dias ('YYYY-MM-DD') no fuso do espaço: a API aplica o fuso
export type AgendaParams = { from: string; to: string; instructorId?: string; vehicleId?: string }

export async function listAgenda(organizationId: number | string, { from, to, instructorId, vehicleId }: AgendaParams): Promise<Paginated<Lesson>> {
  const { data } = await http.get<Paginated<Lesson>>(base(organizationId), {
    params: { from, to, instructor_id: instructorId || undefined, vehicle_id: vehicleId || undefined, per_page: 100 },
    ...handledByScreen,
  })
  return data
}

export async function getLesson(organizationId: number | string, lessonId: number | string): Promise<Lesson> {
  const { data } = await http.get<{ data: Lesson }>(`${base(organizationId)}/${lessonId}`, handledByScreen)
  return data.data
}

// Início no fuso do espaço + duração em minutos -> início e fim em UTC
function toWindow(input: { date: string; start_time: string; duration: string }, timeZone: string) {
  const startsAt = zonedTimeToIso(input.date, input.start_time, timeZone)
  const endsAt = new Date(new Date(startsAt).getTime() + Number(input.duration) * 60_000).toISOString()
  return { starts_at: startsAt, ends_at: endsAt }
}

export async function createLesson(organizationId: number | string, input: ScheduleInput, timeZone: string): Promise<Lesson> {
  const { data } = await http.post<{ data: Lesson }>(
    base(organizationId),
    {
      enrollment_id: Number(input.enrollment_id),
      instructor_id: Number(input.instructor_id),
      vehicle_id: input.vehicle_id ? Number(input.vehicle_id) : null,
      notes: orNull(input.notes),
      ...toWindow(input, timeZone),
    },
    handledByScreen,
  )
  return data.data
}

export async function rescheduleLesson(organizationId: number | string, lessonId: number | string, input: RescheduleInput, timeZone: string): Promise<Lesson> {
  const { data } = await http.post<{ data: Lesson }>(`${base(organizationId)}/${lessonId}/reschedule`, toWindow(input, timeZone), handledByScreen)
  return data.data
}

export async function changeLessonStatus(organizationId: number | string, lessonId: number | string, input: LessonStatusInput): Promise<Lesson> {
  // Duração real e evolução só existem em aula realizada; motivo só em falta e cancelamento
  const payload =
    input.status === 'completed'
      ? { status: input.status, actual_minutes: input.actual_minutes ? Number(input.actual_minutes) : null, evolution: orNull(input.evolution), notes: orNull(input.notes) }
      : { status: input.status, reason: orNull(input.reason), notes: orNull(input.notes) }
  const { data } = await http.patch<{ data: Lesson }>(`${base(organizationId)}/${lessonId}/status`, payload, handledByScreen)
  return data.data
}

// Concluir exige a matrícula liberada para a prática; a API responde com os itens pendentes
export async function completeLesson(organizationId: number | string, lessonId: number): Promise<Lesson> {
  const { data } = await http.patch<{ data: Lesson }>(`${base(organizationId)}/${lessonId}/status`, { status: 'completed' as LessonStatus }, handledByScreen)
  return data.data
}

export async function updateLessonNotes(organizationId: number | string, lessonId: number | string, input: LessonNotesInput, completed: boolean): Promise<Lesson> {
  // Evolução e duração real só podem ser enviadas em aula realizada
  const payload = completed
    ? { notes: orNull(input.notes), evolution: orNull(input.evolution), ...(input.actual_minutes ? { actual_minutes: Number(input.actual_minutes) } : {}) }
    : { notes: orNull(input.notes) }
  const { data } = await http.patch<{ data: Lesson }>(`${base(organizationId)}/${lessonId}`, payload, handledByScreen)
  return data.data
}

export async function updateLessonRegistry(organizationId: number | string, lessonId: number | string, input: RegistryInput): Promise<Lesson> {
  const { data } = await http.patch<{ data: Lesson }>(
    `${base(organizationId)}/${lessonId}/registry`,
    { registry_status: input.registry_status, registry_reference: orNull(input.registry_reference) },
    handledByScreen,
  )
  return data.data
}
