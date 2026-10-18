import { LIST_PAGE_SIZE, PAGE_SIZE } from '../config/organization'
import type { ChecklistItemInput, ProcessInput } from '../schemas/process'
import type { Paginated } from '../types/organization'
import type { ChecklistItem, ProcessStatus, QualificationProcess } from '../types/process'
import { http } from './client'
import { fetchAllPages } from './paginate'

const base = (organizationId: number | string) => `/organizations/${organizationId}/qualification-processes`
const handledByScreen = { skipGlobalError: true } as const
const orNull = (value: string) => value.trim() || null

export type ProcessListParams = { page: number; studentId?: number | string; status?: string; type?: string; category?: string; search?: string }

export async function listProcesses(organizationId: number | string, { page, studentId, status, type, category, search }: ProcessListParams): Promise<Paginated<QualificationProcess>> {
  const request = async (current: number) => {
    const { data } = await http.get<Paginated<QualificationProcess>>(base(organizationId), {
      params: {
        per_page: studentId ? LIST_PAGE_SIZE : PAGE_SIZE,
        page: current,
        student_id: studentId,
        status: status || undefined,
        type: type || undefined,
        category: category || undefined,
        search: search || undefined,
      },
      ...handledByScreen,
    })
    return data
  }
  // Lista de um aluno traz tudo (para escolher na matrícula); a lista geral é paginada
  return studentId ? fetchAllPages(request) : request(page)
}

export async function getProcess(organizationId: number | string, processId: number | string): Promise<QualificationProcess> {
  const { data } = await http.get<{ data: QualificationProcess }>(`${base(organizationId)}/${processId}`, handledByScreen)
  return data.data
}

export async function createProcess(organizationId: number | string, studentId: number, input: ProcessInput): Promise<QualificationProcess> {
  const { data } = await http.post<{ data: QualificationProcess }>(
    base(organizationId),
    {
      student_id: studentId,
      type: input.type,
      uf: input.uf,
      municipality: orNull(input.municipality),
      renach: orNull(input.renach),
      protocol: orNull(input.protocol),
      opened_at: orNull(input.opened_at),
      current_categories: input.current_categories,
      target_categories: input.target_categories,
      notes: orNull(input.notes),
    },
    handledByScreen,
  )
  return data.data
}

export async function updateProcessStatus(organizationId: number | string, processId: number | string, status: ProcessStatus): Promise<QualificationProcess> {
  const { data } = await http.patch<{ data: QualificationProcess }>(`${base(organizationId)}/${processId}`, { status })
  return data.data
}

export async function updateChecklistItem(
  organizationId: number | string,
  processId: number | string,
  itemId: number,
  input: ChecklistItemInput,
): Promise<ChecklistItem> {
  const { data } = await http.patch<{ data: ChecklistItem }>(
    `${base(organizationId)}/${processId}/checklist-items/${itemId}`,
    {
      status: input.status,
      source: orNull(input.source),
      reference: orNull(input.reference),
      occurred_on: orNull(input.occurred_on),
      document_id: input.document_id ? Number(input.document_id) : null,
      notes: orNull(input.notes),
    },
    handledByScreen,
  )
  return data.data
}

// Acrescenta uma exigência obrigatória ao processo (nunca se oculta uma existente)
export async function addChecklistItem(organizationId: number | string, processId: number | string, type: string): Promise<ChecklistItem> {
  const { data } = await http.post<{ data: ChecklistItem }>(`${base(organizationId)}/${processId}/checklist-items`, { type }, handledByScreen)
  return data.data
}

export async function updateProcessData(
  organizationId: number | string,
  processId: number | string,
  input: ProcessInput,
  expectedUpdatedAt?: string,
): Promise<QualificationProcess> {
  const { data } = await http.patch<{ data: QualificationProcess }>(
    `${base(organizationId)}/${processId}`,
    {
      uf: input.uf,
      municipality: orNull(input.municipality),
      renach: orNull(input.renach),
      protocol: orNull(input.protocol),
      opened_at: orNull(input.opened_at),
      current_categories: input.current_categories,
      target_categories: input.target_categories,
      notes: orNull(input.notes),
      expected_updated_at: expectedUpdatedAt,
    },
    handledByScreen,
  )
  return data.data
}
