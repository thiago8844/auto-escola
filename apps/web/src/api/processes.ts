import { LIST_PAGE_SIZE, PAGE_SIZE } from '../config/organization'
import type { ChecklistItemInput, ProcessInput } from '../schemas/process'
import type { Paginated } from '../types/organization'
import type { ChecklistItem, ProcessStatus, QualificationProcess } from '../types/process'
import { http } from './client'

const base = (organizationId: number | string) => `/organizations/${organizationId}/qualification-processes`
const handledByScreen = { skipGlobalError: true } as const
const orNull = (value: string) => value.trim() || null

export type ProcessListParams = { page: number; studentId?: number | string }

export async function listProcesses(organizationId: number | string, { page, studentId }: ProcessListParams): Promise<Paginated<QualificationProcess>> {
  const { data } = await http.get<Paginated<QualificationProcess>>(base(organizationId), {
    // Lista de um aluno traz tudo (para escolher na matrícula); a lista geral é paginada
    params: { per_page: studentId ? LIST_PAGE_SIZE : PAGE_SIZE, page, student_id: studentId },
    ...handledByScreen,
  })
  return data
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
      notes: orNull(input.notes),
    },
    handledByScreen,
  )
  return data.data
}
