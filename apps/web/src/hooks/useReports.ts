import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import {
  downloadReport,
  getDashboard,
  getExamDetail,
  getExamsReport,
  getLessonDetail,
  getLessonsReport,
  getPartnersReport,
  getProcessesReport,
  getStudentSummary,
  getUtilizationReport,
  type ReportParams,
} from '../api/reports'
import { queryKeys } from '../lib/queryKeys'
import { notify } from '../stores/toastStore'

const useReportQuery = <T>(organizationId: number, name: string, params: ReportParams, fn: () => Promise<T>, enabled = true) =>
  useQuery({ queryKey: queryKeys.organizations.report(organizationId, name, params), queryFn: fn, placeholderData: keepPreviousData, enabled })

export const useDashboard = (organizationId: number) =>
  useQuery({ queryKey: queryKeys.organizations.report(organizationId, 'dashboard', {}), queryFn: () => getDashboard(organizationId), refetchInterval: 120_000 })

export const useLessonsReport = (organizationId: number, params: Parameters<typeof getLessonsReport>[1], enabled = true) =>
  useReportQuery(organizationId, 'lessons', params, () => getLessonsReport(organizationId, params), enabled)

export const useLessonDetail = (organizationId: number, params: ReportParams, enabled = true) =>
  useReportQuery(organizationId, 'lessons-detail', params, () => getLessonDetail(organizationId, params), enabled)

export const useExamsReport = (organizationId: number, params: ReportParams, enabled = true) =>
  useReportQuery(organizationId, 'exams', params, () => getExamsReport(organizationId, params), enabled)

export const useExamDetail = (organizationId: number, params: ReportParams, enabled = true) =>
  useReportQuery(organizationId, 'exams-detail', params, () => getExamDetail(organizationId, params), enabled)

export const useUtilizationReport = (organizationId: number, params: ReportParams, enabled = true) =>
  useReportQuery(organizationId, 'utilization', params, () => getUtilizationReport(organizationId, params), enabled)

export const useProcessesReport = (organizationId: number, params: ReportParams, enabled = true) =>
  useReportQuery(organizationId, 'processes', params, () => getProcessesReport(organizationId, params), enabled)

export const usePartnersReport = (organizationId: number, params: ReportParams, enabled = true) =>
  useReportQuery(organizationId, 'partners', params, () => getPartnersReport(organizationId, params), enabled)

export const useStudentSummary = (organizationId: number, studentId: string) =>
  useQuery({ queryKey: queryKeys.organizations.report(organizationId, 'student-summary', { studentId }), queryFn: () => getStudentSummary(organizationId, studentId) })

export function useExportReport(organizationId: number, path: 'lessons' | 'exams') {
  return useMutation({
    mutationFn: (params: ReportParams) => downloadReport(organizationId, path, params),
    meta: { toastOnError: true },
    onSuccess: () => notify.success('Exportação pronta. O arquivo respeita os filtros da tela.'),
  })
}
