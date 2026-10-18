import { useCriticalStore } from '../stores/criticalStore'
import { useNotificationStore, type NotificationInput } from '../stores/notificationStore'
import { useToastStore } from '../stores/toastStore'
import type { AppNotification, CriticalAlert, NoticeType, ToastOptions } from '../types/notice'

// Ponto único para lançar avisos. Veja docs/notificacoes.md.
//
//   notices.toast({ type: 'success', message: 'Salvo!' })                 // balão no canto, fecha sozinho
//   notices.toast({ type: 'warning', message: '...', mode: 'sticky' })    // só fecha no X
//   notices.inbox({ id: 'x', type: 'info', title: '...' })                // vai para o sino
//   notices.notify({ id: 'x', type: 'reminder', title: '...' })           // sino + balão
//   notices.critical({ id: 'x', title: '...', message: '...' })           // modal que exige confirmação
export const notices = {
  toast: (options: ToastOptions) => useToastStore.getState().show(options),

  inbox: (notification: NotificationInput) => useNotificationStore.getState().add(notification),

  // Notificação de verdade: fica no sino e, se `toast` não for false, também aparece como balão
  notify: (
    notification: { id: string; type: NoticeType; title: string; message?: string; action?: AppNotification['action']; muteKey?: string },
    options: { toast?: boolean | Pick<ToastOptions, 'mode' | 'duration'> } = {},
  ) => {
    useNotificationStore.getState().add(notification)
    if (options.toast === false) return
    useToastStore.getState().show({
      type: notification.type,
      title: notification.title,
      message: notification.message ?? notification.title,
      key: `notification:${notification.id}`,
      action: notification.action,
      muteKey: notification.muteKey,
      ...(typeof options.toast === 'object' ? options.toast : {}),
    })
  },

  critical: (alert: CriticalAlert) => useCriticalStore.getState().show(alert),
}
