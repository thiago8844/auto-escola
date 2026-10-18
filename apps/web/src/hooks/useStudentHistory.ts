import { useQueries, useQuery } from '@tanstack/react-query'
import { listEntryDocuments, listExamDocuments, listStudentDocuments } from '../api/documents'
import { listEnrollments } from '../api/enrollments'
import { listLessons } from '../api/lessons'
import { queryKeys } from '../lib/queryKeys'
import type { Enrollment } from '../types/enrollment'

export function useStudentEnrollments(organizationId: number, studentId: string) {
  const params = { studentId, page: 1 }
  return useQuery({
    queryKey: queryKeys.organizations.enrollments(organizationId, params),
    queryFn: () => listEnrollments(organizationId, params),
    enabled: studentId !== '',
  })
}

// A API filtra aulas por matrícula: busca uma lista por matrícula do aluno
export function useEnrollmentsLessons(organizationId: number, enrollments: Enrollment[] | undefined) {
  return useQueries({
    queries: (enrollments ?? []).map((enrollment) => {
      const params = { enrollmentId: enrollment.id }
      return {
        queryKey: queryKeys.organizations.lessons(organizationId, params),
        queryFn: () => listLessons(organizationId, enrollment.id),
      }
    }),
  })
}

// Documentos são só da equipe: para instrutor a consulta fica desligada
export function useStudentDocuments(organizationId: number, studentId: string, enabled: boolean) {
  const params = { studentId }
  return useQuery({
    queryKey: queryKeys.organizations.documents(organizationId, params),
    queryFn: () => listStudentDocuments(organizationId, studentId),
    enabled,
  })
}

export function useExamDocuments(organizationId: number, examId: number, enabled: boolean) {
  const params = { examId }
  return useQuery({
    queryKey: queryKeys.organizations.documents(organizationId, params),
    queryFn: () => listExamDocuments(organizationId, examId),
    enabled,
  })
}

export function useEntryDocuments(organizationId: number, entryId: number | null) {
  return useQuery({
    queryKey: queryKeys.organizations.documents(organizationId, { entryId }),
    queryFn: () => listEntryDocuments(organizationId, entryId!),
    enabled: entryId !== null,
  })
}
