import { create } from 'zustand'
import { emptyPreferences, preferencesStorage, type UserPreferences } from '../lib/preferencesStorage'

type PreferencesState = UserPreferences & {
  userId: number | null
  // Carrega as preferências do usuário logado (e zera ao sair)
  loadFor: (userId: number | null) => void
  isMuted: (key: string) => boolean
  mute: (key: string) => void
  unmute: (key: string) => void
  unmuteAll: () => void
}

function persist(state: PreferencesState) {
  if (state.userId !== null) preferencesStorage.save(state.userId, { mutedNotices: state.mutedNotices })
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...emptyPreferences(),
  userId: null,
  loadFor: (userId) => set({ userId, ...(userId === null ? emptyPreferences() : preferencesStorage.load(userId)) }),
  isMuted: (key) => key in get().mutedNotices,
  mute: (key) => {
    set((state) => ({ mutedNotices: { ...state.mutedNotices, [key]: new Date().toISOString() } }))
    persist(get())
  },
  unmute: (key) => {
    set((state) => ({ mutedNotices: Object.fromEntries(Object.entries(state.mutedNotices).filter(([muted]) => muted !== key)) }))
    persist(get())
  },
  unmuteAll: () => {
    set({ mutedNotices: {} })
    persist(get())
  },
}))
