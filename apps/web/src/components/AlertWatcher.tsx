import { useAlertWatcher } from '../hooks/useAlertWatcher'

// Não desenha nada: mantém as notificações do espaço atualizadas e avisa das novas
export function AlertWatcher({ organizationId }: { organizationId: number }) {
  useAlertWatcher(organizationId)
  return null
}
