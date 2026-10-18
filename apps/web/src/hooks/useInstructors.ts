import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createInstructor, getInstructor, listInstructors, setInstructorLink, updateInstructor, type InstructorListParams } from '../api/instructors'
import { queryKeys } from '../lib/queryKeys'
import type { InstructorInput } from '../schemas/instructor'
import { notify } from '../stores/toastStore'

export function useInstructors(organizationId: number, params: InstructorListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.organizations.instructors(organizationId, params),
    queryFn: () => listInstructors(organizationId, params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useInstructor(organizationId: number, instructorId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.instructor(organizationId, instructorId ?? ''),
    queryFn: () => getInstructor(organizationId, instructorId!),
    enabled: !!instructorId,
  })
}

export function useCreateInstructor(organizationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: InstructorInput) => createInstructor(organizationId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }),
  })
}

export function useUpdateInstructor(organizationId: number, instructorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: InstructorInput) => updateInstructor(organizationId, instructorId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }),
  })
}

export function useSetInstructorLink(organizationId: number, instructorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (active: boolean) => setInstructorLink(organizationId, instructorId, active),
    meta: { toastOnError: true },
    onSuccess: (instructor) => {
      notify.success(instructor.active ? 'Vínculo ativado.' : 'Vínculo desativado.')
      return queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) })
    },
  })
}
