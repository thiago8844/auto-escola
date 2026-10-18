import type { AlertCounters, AlertItem, AlertSettings } from '../types/alert'
import type { Paginated } from '../types/organization'
import { http } from './client'

const base = (organizationId: number | string) => `/organizations/${organizationId}`
const handledByScreen = { skipGlobalError: true } as const

export type AlertListParams = {
  page: number
  perPage?: number
  status?: 'open' | 'resolved' | 'all'
  unread?: boolean
  archived?: boolean
  category?: string
  priority?: string
}

export type AlertPage = Paginated<AlertItem> & { meta: Paginated<AlertItem>['meta'] & AlertCounters }

export async function listAlerts(organizationId: number | string, p: AlertListParams): Promise<AlertPage> {
  const { data } = await http.get<AlertPage>(`${base(organizationId)}/alerts`, {
    params: {
      page: p.page,
      per_page: p.perPage ?? 15,
      status: p.status,
      unread: p.unread ? 1 : undefined,
      archived: p.archived ? 1 : undefined,
      category: p.category || undefined,
      priority: p.priority || undefined,
    },
    ...handledByScreen,
  })
  return data
}

export async function getAlertSummary(organizationId: number | string): Promise<AlertCounters> {
  const { data } = await http.get<{ data: AlertCounters }>(`${base(organizationId)}/alerts/summary`, handledByScreen)
  return data.data
}

const action = async (organizationId: number | string, path: string): Promise<AlertCounters> => {
  const { data } = await http.post<{ data: AlertCounters }>(`${base(organizationId)}/alerts/${path}`, undefined, handledByScreen)
  return data.data
}

export const markAlertRead = (organizationId: number | string, alertId: number) => action(organizationId, `${alertId}/read`)
export const markAllAlertsRead = (organizationId: number | string) => action(organizationId, 'read-all')
export const archiveAlert = (organizationId: number | string, alertId: number) => action(organizationId, `${alertId}/archive`)
export const unarchiveAlert = (organizationId: number | string, alertId: number) => action(organizationId, `${alertId}/unarchive`)

// Reprocessa as notificações do espaço agora (o servidor também faz isso sozinho a cada 10 minutos)
export async function refreshAlerts(organizationId: number | string): Promise<void> {
  await http.post(`${base(organizationId)}/alerts/refresh`, undefined, handledByScreen)
}

export async function getAlertSettings(organizationId: number | string): Promise<AlertSettings> {
  const { data } = await http.get<{ data: AlertSettings }>(`${base(organizationId)}/alert-settings`, handledByScreen)
  return data.data
}

export async function updateAlertSettings(organizationId: number | string, input: Partial<AlertSettings>): Promise<AlertSettings> {
  const { data } = await http.patch<{ data: AlertSettings }>(`${base(organizationId)}/alert-settings`, input, handledByScreen)
  return data.data
}
