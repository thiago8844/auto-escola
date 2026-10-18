import { create } from 'zustand'
import type { AppNotification } from '../types/notice'

export type NotificationInput = Omit<AppNotification, 'createdAt' | 'readAt'> & Partial<Pick<AppNotification, 'createdAt' | 'readAt'>>

type NotificationState = {
  // Da mais nova para a mais antiga
  items: AppNotification[]
  // Adiciona (ou atualiza, se o id já existir). Aceita notificações da API quando ela existir.
  add: (notification: NotificationInput) => void
  // Troca a lista inteira (ex.: resposta de GET /notifications)
  setAll: (items: AppNotification[]) => void
  markRead: (id: string) => void
  markAllRead: () => void
  remove: (id: string) => void
  clear: () => void
}

const byNewest = (a: AppNotification, b: AppNotification) => b.createdAt.localeCompare(a.createdAt)

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  add: (notification) =>
    set((state) => {
      const item: AppNotification = { createdAt: new Date().toISOString(), readAt: null, ...notification }
      return { items: [item, ...state.items.filter((n) => n.id !== item.id)].sort(byNewest) }
    }),
  setAll: (items) => set({ items: [...items].sort(byNewest) }),
  markRead: (id) => set((state) => ({ items: state.items.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: new Date().toISOString() } : n)) })),
  markAllRead: () => set((state) => ({ items: state.items.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() })) })),
  remove: (id) => set((state) => ({ items: state.items.filter((n) => n.id !== id) })),
  clear: () => set({ items: [] }),
}))

export const selectUnreadCount = (state: NotificationState) => state.items.filter((n) => !n.readAt).length
