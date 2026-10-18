import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createEnrollment, getEnrollment, listEnrollments, updateEnrollmentStatus, type EnrollmentListParams } from '../api/enrollments'
import { listLessons, completeLesson } from '../api/lessons'
import { queryKeys } from '../lib/queryKeys'
import type { EnrollmentInput } from '../schemas/enrollment'
import type { EnrollmentStatus } from '../types/enrollment'
import { PAGE_SIZE } from '../config/organization'

export function useEnrollments(organizationId: number, page: number) {
  const params: EnrollmentListParams = { page, perPage: PAGE_SIZE }
  return useQuery({
    queryKey: queryKeys.organizations.enrollments(organizationId, params),
    queryFn: () => listEnrollments(organizationId, params),
    placeholderData: keepPreviousData,
  })
}

export function useEnrollment(organizationId: number, enrollmentId: string) {
  return useQuery({
    queryKey: queryKeys.organizations.enrollment(organizationId, enrollmentId),
    queryFn: () => getEnrollment(organizationId, enrollmentId),
  })
}

export function useCreateEnrollment(organizationId: number, studentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EnrollmentInput) => createEnrollment(organizationId, studentId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }),
  })
}

export function useUpdateEnrollmentStatus(organizationId: number, enrollmentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: EnrollmentStatus) => updateEnrollmentStatus(organizationId, enrollmentId, status),
    meta: { toastOnError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }),
  })
}

export function useEnrollmentLessons(organizationId: number, enrollmentId: string) {
  const params = { enrollmentId }
  return useQuery({
    queryKey: queryKeys.organizations.lessons(organizationId, params),
    queryFn: () => listLessons(organizationId, enrollmentId),
  })
}

// Concluir aula: o erro (ex.: prática não liberada) é mostrado pela tela, com o motivo da API
export function useCompleteLesson(organizationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (lessonId: number) => completeLesson(organizationId, lessonId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }),
  })
}
