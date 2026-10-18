import { create } from 'zustand'
import { MAX_VISIBLE_TOASTS, NOTICE_TYPES } from '../config/notices'
import type { ToastData, ToastOptions } from '../types/notice'
import { usePreferencesStore } from './preferencesStore'

type ToastState = {
  // Do mais antigo ao mais novo: o novo entra embaixo dos que já estão na tela
  toasts: ToastData[]
  show: (options: ToastOptions) => number | null
  remove: (id: number) => void
  clear: () => void
}

let nextId = 1

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (options) => {
    // Aviso silenciado pelo usuário não aparece mais
    if (options.muteKey && usePreferencesStore.getState().isMuted(options.muteKey)) return null

    const defaults = NOTICE_TYPES[options.type]
    const explicitKey = options.key !== undefined
    const key = options.key ?? `${options.type}:${options.message}`

    const existing = get().toasts.find((toast) => toast.key === key)
    // Sem chave explícita, o mesmo aviso repetido (ex.: várias requisições com o mesmo erro) é ignorado
    if (existing && !explicitKey) return existing.id

    const toast: ToastData = {
      id: nextId++,
      key,
      type: options.type,
      title: options.title,
      message: options.message,
      mode: options.mode ?? defaults.mode,
      duration: options.duration ?? defaults.duration,
      muteKey: options.muteKey,
      action: options.action,
    }
    // Chave explícita repetida substitui o toast antigo (reinicia o tempo)
    set((state) => ({ toasts: [...state.toasts.filter((t) => t.key !== key), toast] }))
    return toast.id
  },
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

export const visibleToasts = (toasts: ToastData[]) => toasts.slice(0, MAX_VISIBLE_TOASTS)

// Atalhos para o caso comum: um texto, tipo padrão. Para o resto, use `notices` (lib/notices.ts).
const quick = (type: ToastOptions['type']) => (message: string) => useToastStore.getState().show({ type, message })

export const notify = {
  error: quick('error'),
  warning: quick('warning'),
  success: quick('success'),
  info: quick('info'),
  reminder: quick('reminder'),
}
