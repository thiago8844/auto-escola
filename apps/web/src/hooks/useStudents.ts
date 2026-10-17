import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createStudent, getStudent, listStudents, updateStudent, type StudentListParams } from '../api/students'
import { queryKeys } from '../lib/queryKeys'
import type { StudentInput } from '../schemas/student'

export function useStudents(organizationId: number, params: StudentListParams) {
  return useQuery({
    queryKey: queryKeys.organizations.students(organizationId, params),
    queryFn: () => listStudents(organizationId, params),
    placeholderData: keepPreviousData,
  })
}

export function useStudent(organizationId: number, studentId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.student(organizationId, studentId ?? ''),
    queryFn: () => getStudent(organizationId, studentId!),
    enabled: !!studentId,
  })
}

export function useCreateStudent(organizationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: StudentInput) => createStudent(organizationId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }),
  })
}

export function useUpdateStudent(organizationId: number, studentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: StudentInput) => updateStudent(organizationId, studentId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }),
  })
}
