import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changeLessonStatus,
  createLesson,
  getLesson,
  listAgenda,
  rescheduleLesson,
  updateLessonNotes,
  updateLessonRegistry,
  type AgendaParams,
} from '../api/lessons'
import { queryKeys } from '../lib/queryKeys'
import type { LessonNotesInput, LessonStatusInput, RegistryInput, RescheduleInput, ScheduleInput } from '../schemas/lesson'
import { notify } from '../stores/toastStore'

export function useAgenda(organizationId: number, params: AgendaParams) {
  return useQuery({
    queryKey: queryKeys.organizations.agenda(organizationId, params),
    queryFn: () => listAgenda(organizationId, params),
    placeholderData: keepPreviousData,
  })
}

export function useLesson(organizationId: number, lessonId: string) {
  return useQuery({
    queryKey: queryKeys.organizations.lesson(organizationId, lessonId),
    queryFn: () => getLesson(organizationId, lessonId),
  })
}

// Qualquer alteração de aula pode mexer na agenda, no histórico do aluno e na matrícula
export function useInvalidateOrganization(organizationId: number) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) })
}

export function useCreateLesson(organizationId: number, timeZone: string) {
  const invalidate = useInvalidateOrganization(organizationId)
  return useMutation({
    mutationFn: (input: ScheduleInput) => createLesson(organizationId, input, timeZone),
    onSuccess: invalidate,
  })
}

export function useRescheduleLesson(organizationId: number, lessonId: string, timeZone: string) {
  const invalidate = useInvalidateOrganization(organizationId)
  return useMutation({
    mutationFn: (input: RescheduleInput) => rescheduleLesson(organizationId, lessonId, input, timeZone),
    onSuccess: () => {
      notify.success('Aula remarcada.')
      return invalidate()
    },
  })
}

export function useChangeLessonStatus(organizationId: number, lessonId: string) {
  const invalidate = useInvalidateOrganization(organizationId)
  return useMutation({
    mutationFn: (input: LessonStatusInput) => changeLessonStatus(organizationId, lessonId, input),
    onSuccess: () => {
      notify.success('Situação da aula atualizada.')
      return invalidate()
    },
  })
}

export function useUpdateLessonNotes(organizationId: number, lessonId: string, completed: boolean) {
  const invalidate = useInvalidateOrganization(organizationId)
  return useMutation({
    mutationFn: (input: LessonNotesInput) => updateLessonNotes(organizationId, lessonId, input, completed),
    onSuccess: () => {
      notify.success('Aula atualizada.')
      return invalidate()
    },
  })
}

export function useUpdateLessonRegistry(organizationId: number, lessonId: string) {
  const invalidate = useInvalidateOrganization(organizationId)
  return useMutation({
    mutationFn: (input: RegistryInput) => updateLessonRegistry(organizationId, lessonId, input),
    onSuccess: () => {
      notify.success('Registro oficial atualizado.')
      return invalidate()
    },
  })
}
