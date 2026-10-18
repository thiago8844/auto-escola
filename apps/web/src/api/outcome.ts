import type { Paginated } from '../types/organization'
import type { AuditEvent, ClosureCheck } from '../types/outcome'
import type { QualificationProcess } from '../types/process'
import { http } from './client'

const base = (organizationId: number | string, processId: number | string) => `/organizations/${organizationId}/qualification-processes/${processId}`
const handledByScreen = { skipGlobalError: true } as const

export async function getClosureCheck(organizationId: number | string, processId: number | string): Promise<ClosureCheck> {
  const { data } = await http.get<{ data: ClosureCheck }>(`${base(organizationId, processId)}/closure-check`, handledByScreen)
  return data.data
}

export type IssuanceInput = {
  status: 'pending' | 'issued' | 'delivered'
  kind: 'ppd' | 'cnh' | null
  reference: string | null
  issued_at: string | null
  delivered_at: string | null
  definitive_follow_up: boolean
  definitive_due_at: string | null
  reason: string | null
}

async function post(url: string, body: object): Promise<QualificationProcess> {
  const { data } = await http.post<{ data: QualificationProcess }>(url, body, handledByScreen)
  return data.data
}

export const registerIssuance = (o: number | string, p: number | string, input: IssuanceInput) => post(`${base(o, p)}/issuance`, input)

export const closeProcess = (o: number | string, p: number | string, input: { kind: string; reason: string | null; cancel_future: boolean; acknowledge_pending: boolean }) =>
  post(`${base(o, p)}/close`, input)

export const reopenProcess = (o: number | string, p: number | string, reason: string) => post(`${base(o, p)}/reopen`, { reason })

export const renounceCategory = (o: number | string, p: number | string, category: string, reason: string) => post(`${base(o, p)}/categories/${category}/renunciation`, { reason })

export const confirmRenunciation = (o: number | string, p: number | string, category: string, reference: string) =>
  post(`${base(o, p)}/categories/${category}/renunciation/confirm`, { reference })

export const revertRenunciation = (o: number | string, p: number | string, category: string, reason: string) =>
  post(`${base(o, p)}/categories/${category}/renunciation/revert`, { reason })

export type TimelineScope = { kind: 'student' | 'process' | 'organization'; id?: number | string }

export async function listTimeline(organizationId: number | string, scope: TimelineScope, page: number, category?: string): Promise<Paginated<AuditEvent>> {
  const root = `/organizations/${organizationId}`
  const url =
    scope.kind === 'student' ? `${root}/students/${scope.id}/timeline` : scope.kind === 'process' ? `${base(organizationId, scope.id!)}/timeline` : `${root}/audit-events`
  const { data } = await http.get<Paginated<AuditEvent>>(url, { params: { page, per_page: 15, category: category || undefined }, ...handledByScreen })
  return data
}
