import { useMutationState, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { refreshAlerts } from '../api/alerts'
import { notices } from '../lib/notices'
import { queryKeys } from '../lib/queryKeys'
import { useAuthStore } from '../stores/authStore'
import type { AlertItem } from '../types/alert'
import { alertPath } from '../utils/alertPath'
import { organizationPaths } from '../config/paths'
import { markAlertRead } from '../api/alerts'
import { useAlerts } from './useAlerts'

const REFRESH_EVERY_MS = 5 * 60_000
const AFTER_CHANGE_MS = 3_000

const storageKey = (userId: number, organizationId: number) => `rc-alerts-announced:${userId}:${organizationId}`
const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
const write = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Sem armazenamento (modo privado): o aviso só deixa de lembrar o que já mostrou
  }
}

// Mantém as pendências frescas e avisa das novas sem atrapalhar o trabalho:
//  - recalcula ao entrar, a cada 5 minutos e 3 s depois de qualquer ação que altere dados;
//  - pendência URGENTE não lida abre o alerta máximo (confirmar marca como lida);
//  - as demais novas viram um balão (até 3; "Não mostrar novamente" disponível), nunca um bloqueio.
export function useAlertWatcher(organizationId: number) {
  const queryClient = useQueryClient()
  const userId = useAuthStore((state) => state.user?.id)
  const announced = useRef(new Set<number>())
  const list = useAlerts(organizationId, { page: 1, perPage: 50, status: 'open' })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: [...queryKeys.organizations.detail(organizationId), 'alerts'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.organizations.alertSummary(organizationId) })
  }

  // Recalcular periodicamente e quando algo muda no sistema
  useEffect(() => {
    const run = () => void refreshAlerts(organizationId).then(invalidate).catch(() => undefined)
    run()
    const timer = window.setInterval(run, REFRESH_EVERY_MS)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const successes = useMutationState({ filters: { status: 'success' }, select: (mutation) => mutation.state.submittedAt })
  const lastSuccess = successes.length > 0 ? Math.max(...successes) : 0
  useEffect(() => {
    if (lastSuccess === 0) return
    const timer = window.setTimeout(() => void refreshAlerts(organizationId).then(invalidate).catch(() => undefined), AFTER_CHANGE_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSuccess, organizationId])

  // Anunciar o que é novo
  const items = list.data?.data
  useEffect(() => {
    if (!items || userId === undefined) return
    const key = storageKey(userId, organizationId)
    const lastSeen = read(key)
    const unread = items.filter((alert) => !alert.read_at && !announced.current.has(alert.id))

    const open = (alert: AlertItem) => alertPath(organizationId, alert)

    for (const alert of unread.filter((a) => a.priority === 'critical')) {
      announced.current.add(alert.id)
      notices.critical({
        id: `alert-${alert.id}`,
        title: alert.title,
        message: alert.message ?? 'Esta pendência precisa de ação agora.',
        severity: 'danger',
        action: { label: 'Abrir', to: open(alert) },
        onAcknowledge: () => void markAlertRead(organizationId, alert.id).then(invalidate),
      })
    }

    const others = unread.filter((a) => a.priority !== 'critical' && a.priority !== 'low')
    const fresh = lastSeen === null ? [] : others.filter((a) => a.first_seen_at > lastSeen)
    fresh.slice(0, 3).forEach((alert) => {
      announced.current.add(alert.id)
      notices.toast({
        type: alert.priority === 'high' ? 'warning' : 'info',
        title: alert.title,
        message: alert.message ?? alert.title,
        key: `alert:${alert.id}`,
        muteKey: 'alerts.toast',
        action: { label: 'Abrir', to: open(alert) },
      })
    })
    if (fresh.length > 3) {
      notices.toast({ type: 'info', message: `Mais ${fresh.length - 3} pendências novas. Veja todas no sino.`, key: 'alerts:more', muteKey: 'alerts.toast', action: { label: 'Ver pendências', to: organizationPaths(organizationId).alerts } })
    }
    if (lastSeen === null && others.length > 0) {
      notices.toast({ type: 'info', message: `Você tem ${others.length} ${others.length === 1 ? 'pendência' : 'pendências'} para acompanhar.`, key: 'alerts:welcome', muteKey: 'alerts.toast', action: { label: 'Ver pendências', to: organizationPaths(organizationId).alerts } })
    }

    const newest = items.map((a) => a.first_seen_at).sort().at(-1)
    if (newest && (lastSeen === null || newest > lastSeen)) write(key, newest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, userId, organizationId])
}
