import type { Exam, ExamStatus, ExternalFee, FeeParty, FeeStatus } from '../types/exam'
import type { Paginated } from '../types/organization'
import { http } from './client'

const base = (organizationId: number | string) => `/organizations/${organizationId}`
const handledByScreen = { skipGlobalError: true } as const

export type ExamListParams = {
  page: number
  from?: string
  to?: string
  category?: string
  status?: string
  q?: string
  studentId?: number | string
  processId?: number | string
  order?: 'asc' | 'desc'
  perPage?: number
}

export async function listExams(organizationId: number | string, p: ExamListParams): Promise<Paginated<Exam>> {
  const { data } = await http.get<Paginated<Exam>>(`${base(organizationId)}/exams`, {
    params: {
      page: p.page,
      per_page: p.perPage ?? 15,
      from: p.from || undefined,
      to: p.to || undefined,
      category: p.category || undefined,
      status: p.status || undefined,
      q: p.q || undefined,
      student_id: p.studentId,
      qualification_process_id: p.processId,
      order: p.order,
    },
    ...handledByScreen,
  })
  return data
}

export async function getExam(organizationId: number | string, examId: number | string): Promise<Exam> {
  const { data } = await http.get<{ data: Exam }>(`${base(organizationId)}/exams/${examId}`, handledByScreen)
  return data.data
}

export type ExamInput = {
  qualification_process_id: number
  enrollment_id: number | null
  category: string
  scheduled_at: string
  location: string | null
  // Ausente = autoescola do aluno; null = o próprio espaço
  partner_id?: number | null
  notes: string | null
  instructor_id: number | null
  vehicle_id: number | null
}

export type ExamEditInputPayload = {
  scheduled_at: string
  location: string | null
  partner_id: number | null
  notes: string | null
  instructor_id: number | null
  vehicle_id: number | null
}

export async function createExam(organizationId: number | string, input: ExamInput): Promise<Exam> {
  const { data } = await http.post<{ data: Exam }>(`${base(organizationId)}/exams`, input, handledByScreen)
  return data.data
}

export async function updateExam(organizationId: number | string, examId: number | string, input: Partial<ExamEditInputPayload>): Promise<Exam> {
  const { data } = await http.patch<{ data: Exam }>(`${base(organizationId)}/exams/${examId}`, input, handledByScreen)
  return data.data
}

export async function rescheduleExam(
  organizationId: number | string,
  examId: number | string,
  input: { scheduled_at: string; reason: string },
): Promise<Exam> {
  const { data } = await http.post<{ data: Exam }>(`${base(organizationId)}/exams/${examId}/reschedule`, input, handledByScreen)
  return data.data
}

export async function recordExamResult(organizationId: number | string, examId: number | string, status: ExamStatus, reason: string | null, correction = false): Promise<Exam> {
  const { data } = await http.post<{ data: Exam }>(`${base(organizationId)}/exams/${examId}/${correction ? 'result-correction' : 'result'}`, { status, reason }, handledByScreen)
  return data.data
}

// ---- taxas externas

export type FeeListParams = { page: number; processId?: number | string; open?: boolean; examId?: number | string }

export async function listFees(organizationId: number | string, p: FeeListParams): Promise<Paginated<ExternalFee>> {
  const { data } = await http.get<Paginated<ExternalFee>>(`${base(organizationId)}/external-fees`, {
    params: { page: p.page, per_page: 50, qualification_process_id: p.processId, open: p.open || undefined, practical_exam_id: p.examId },
    ...handledByScreen,
  })
  return data
}

export type FeeInput = {
  qualification_process_id?: number
  kind: string
  voucher_number: string | null
  amount_cents: number | null
  issued_at: string | null
  due_date: string | null
  reference: string | null
  obligor: FeeParty
  notes: string | null
  receipt_document_id: number | null
  exam_ids: number[]
}

export async function saveFee(organizationId: number | string, feeId: number | null, input: FeeInput): Promise<ExternalFee> {
  const url = `${base(organizationId)}/external-fees${feeId ? `/${feeId}` : ''}`
  const { data } = feeId ? await http.patch<{ data: ExternalFee }>(url, input, handledByScreen) : await http.post<{ data: ExternalFee }>(url, input, handledByScreen)
  return data.data
}

export async function changeFeeStatus(
  organizationId: number | string,
  feeId: number,
  input: { status: FeeStatus; reason: string | null; paid_by: FeeParty | null; receipt_document_id?: number | null },
): Promise<ExternalFee> {
  const { data } = await http.post<{ data: ExternalFee }>(`${base(organizationId)}/external-fees/${feeId}/status`, input, handledByScreen)
  return data.data
}

export async function settleReimbursement(organizationId: number | string, feeId: number): Promise<ExternalFee> {
  const { data } = await http.post<{ data: ExternalFee }>(`${base(organizationId)}/external-fees/${feeId}/reimbursement`, {}, handledByScreen)
  return data.data
}

// Anexa o arquivo ao exame ou à taxa (documento privado; anexar não confirma nada)
export async function uploadExamDocument(organizationId: number | string, input: { file: File; type: string; examId?: number; processId?: number; notes?: string }) {
  const form = new FormData()
  form.append('file', input.file)
  form.append('type', input.type)
  if (input.examId) form.append('practical_exam_id', String(input.examId))
  if (input.processId) form.append('qualification_process_id', String(input.processId))
  if (input.notes) form.append('notes', input.notes)
  const { data } = await http.post<{ data: { id: number } }>(`${base(organizationId)}/documents`, form, handledByScreen)
  return data.data
}
