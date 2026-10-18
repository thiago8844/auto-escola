import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  archiveAlert,
  getAlertSettings,
  getAlertSummary,
  listAlerts,
  markAlertRead,
  markAllAlertsRead,
  refreshAlerts,
  unarchiveAlert,
  updateAlertSettings,
  type AlertListParams,
} from '../api/alerts'
import { queryKeys } from '../lib/queryKeys'
import { notify } from '../stores/toastStore'
import type { AlertSettings } from '../types/alert'

// O sino consulta com frequência e ao voltar para a aba; o servidor guarda o que cada pessoa já leu
const POLL_MS = 60_000

export function useAlerts(organizationId: number, params: AlertListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.organizations.alerts(organizationId, params),
    queryFn: () => listAlerts(organizationId, params),
    placeholderData: keepPreviousData,
    refetchInterval: POLL_MS,
    enabled,
  })
}

export function useAlertSummary(organizationId: number | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.alertSummary(organizationId ?? ''),
    queryFn: () => getAlertSummary(organizationId!),
    enabled: organizationId !== undefined,
    refetchInterval: POLL_MS,
  })
}

function useAlertMutation<T>(organizationId: number, mutationFn: (input: T) => Promise<unknown>, message?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    meta: { toastOnError: true },
    onSuccess: async () => {
      if (message) notify.success(message)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [...queryKeys.organizations.detail(organizationId), 'alerts'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.organizations.alertSummary(organizationId) }),
      ])
    },
  })
}

export const useMarkAlertRead = (organizationId: number) => useAlertMutation(organizationId, (id: number) => markAlertRead(organizationId, id))
export const useMarkAllAlertsRead = (organizationId: number) => useAlertMutation(organizationId, () => markAllAlertsRead(organizationId), 'Notificações marcadas como lidas.')
export const useArchiveAlert = (organizationId: number) => useAlertMutation(organizationId, (id: number) => archiveAlert(organizationId, id), 'Notificação arquivada.')
export const useUnarchiveAlert = (organizationId: number) => useAlertMutation(organizationId, (id: number) => unarchiveAlert(organizationId, id), 'Notificação restaurada.')
export const useRefreshAlerts = (organizationId: number) => useAlertMutation(organizationId, () => refreshAlerts(organizationId))

export function useAlertSettings(organizationId: number) {
  return useQuery({ queryKey: queryKeys.organizations.alertSettings(organizationId), queryFn: () => getAlertSettings(organizationId) })
}

export function useUpdateAlertSettings(organizationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<AlertSettings>) => updateAlertSettings(organizationId, input),
    onSuccess: () => {
      notify.success('Configurações de alertas salvas.')
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.organizations.alertSettings(organizationId) }),
        refreshAlerts(organizationId).then(() => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.alertSummary(organizationId) })),
      ])
    },
  })
}
