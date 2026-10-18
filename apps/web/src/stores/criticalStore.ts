import { create } from 'zustand'
import type { CriticalAlert } from '../types/notice'
import { usePreferencesStore } from './preferencesStore'

type CriticalState = {
  // Fila: aparece um por vez, na ordem em que chegaram
  queue: CriticalAlert[]
  show: (alert: CriticalAlert) => void
  // Chamado quando o usuário confirma
  acknowledge: (id: string, options?: { mute?: boolean }) => void
  clear: () => void
}

export const useCriticalStore = create<CriticalState>((set, get) => ({
  queue: [],
  show: (alert) => {
    if (alert.muteKey && usePreferencesStore.getState().isMuted(alert.muteKey)) return
    // O mesmo alerta (mesmo id) não entra duas vezes na fila
    if (get().queue.some((a) => a.id === alert.id)) return
    set((state) => ({ queue: [...state.queue, alert] }))
  },
  acknowledge: (id, options) => {
    const alert = get().queue.find((a) => a.id === id)
    if (alert?.muteKey && options?.mute) usePreferencesStore.getState().mute(alert.muteKey)
    set((state) => ({ queue: state.queue.filter((a) => a.id !== id) }))
  },
  clear: () => set({ queue: [] }),
}))
