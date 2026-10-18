import { useAuthStore } from '../stores/authStore'
import { useCriticalStore } from '../stores/criticalStore'
import { useNotificationStore } from '../stores/notificationStore'
import { usePreferencesStore } from '../stores/preferencesStore'
import { useToastStore } from '../stores/toastStore'

// Liga os avisos ao usuário logado: carrega as preferências dele ao entrar
// e descarta avisos, notificações e alertas ao sair ou trocar de conta.
export function initNotices() {
  let currentUserId: number | null = null

  const sync = (userId: number | null) => {
    if (userId === currentUserId) return
    currentUserId = userId
    usePreferencesStore.getState().loadFor(userId)
    useToastStore.getState().clear()
    useCriticalStore.getState().clear()
    useNotificationStore.getState().clear()
  }

  sync(useAuthStore.getState().user?.id ?? null)
  useAuthStore.subscribe((state) => sync(state.user?.id ?? null))
}
