import { create } from 'zustand'

export type ToastVariant = 'danger' | 'warning' | 'success' | 'info'

export type ToastItem = {
  id: number
  variant: ToastVariant
  message: string
}

type ToastState = {
  toasts: ToastItem[]
  push: (variant: ToastVariant, message: string) => void
  dismiss: (id: number) => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (variant, message) =>
    set((state) => {
      // Evita empilhar o mesmo aviso quando várias requisições falham juntas
      if (state.toasts.some((t) => t.message === message)) return state
      return { toasts: [...state.toasts, { id: nextId++, variant, message }] }
    }),
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export const notify = {
  error: (message: string) => useToastStore.getState().push('danger', message),
  warning: (message: string) => useToastStore.getState().push('warning', message),
  success: (message: string) => useToastStore.getState().push('success', message),
  info: (message: string) => useToastStore.getState().push('info', message),
}
