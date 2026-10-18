import type { Dashboard, ExamDetail, ExamsReport, LessonDetail, LessonGroupBy, LessonsReport, PartnersReport, ProcessesReport, StudentSummary, UtilizationReport } from '../types/reports'
import { http } from './client'

const base = (organizationId: number | string) => `/organizations/${organizationId}`
const handledByScreen = { skipGlobalError: true } as const

export type ReportParams = Record<string, string | number | undefined>

const clean = (params: ReportParams) => Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''))

async function get<T>(organizationId: number | string, path: string, params: ReportParams = {}): Promise<T> {
  const { data } = await http.get<{ data: T }>(`${base(organizationId)}/reports/${path}`, { params: clean(params), ...handledByScreen })
  return data.data
}

export const getDashboard = (organizationId: number | string) => get<Dashboard>(organizationId, 'dashboard')
export const getLessonsReport = (organizationId: number | string, params: ReportParams & { group_by?: LessonGroupBy }) => get<LessonsReport>(organizationId, 'lessons', params)
export const getExamsReport = (organizationId: number | string, params: ReportParams) => get<ExamsReport>(organizationId, 'exams', params)
export const getUtilizationReport = (organizationId: number | string, params: ReportParams) => get<UtilizationReport>(organizationId, 'utilization', params)
export const getProcessesReport = (organizationId: number | string, params: ReportParams) => get<ProcessesReport>(organizationId, 'processes', params)
export const getPartnersReport = (organizationId: number | string, params: ReportParams) => get<PartnersReport>(organizationId, 'partners', params)

// Detalhe paginado: mesma consulta do indicador, então o total confere com o resumo
export async function getLessonDetail(organizationId: number | string, params: ReportParams): Promise<LessonDetail> {
  const { data } = await http.get<LessonDetail>(`${base(organizationId)}/reports/lessons/detail`, { params: clean(params), ...handledByScreen })
  return data
}

export async function getExamDetail(organizationId: number | string, params: ReportParams): Promise<ExamDetail> {
  const { data } = await http.get<ExamDetail>(`${base(organizationId)}/reports/exams/detail`, { params: clean(params), ...handledByScreen })
  return data
}

export async function getStudentSummary(organizationId: number | string, studentId: number | string): Promise<StudentSummary> {
  const { data } = await http.get<{ data: StudentSummary }>(`${base(organizationId)}/students/${studentId}/summary`, handledByScreen)
  return data.data
}

// CSV completo conforme os filtros: baixado com a sessão (não existe link público)
export async function downloadReport(organizationId: number | string, path: 'lessons' | 'exams', params: ReportParams): Promise<void> {
  const response = await http.get<Blob>(`${base(organizationId)}/reports/${path}/export`, { params: clean(params), responseType: 'blob', ...handledByScreen })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = `${path === 'lessons' ? 'aulas' : 'exames'}-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
