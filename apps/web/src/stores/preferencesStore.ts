import { create } from 'zustand'
import { emptyPreferences, preferencesStorage, type NavigationPreference, type UserPreferences } from '../lib/preferencesStorage'

type PreferencesState = UserPreferences & {
  userId: number | null
  // Carrega as preferências do usuário logado (e zera ao sair)
  loadFor: (userId: number | null) => void
  isMuted: (key: string) => boolean
  mute: (key: string) => void
  unmute: (key: string) => void
  unmuteAll: () => void
  setDefaultSpace: (id: string | null) => void
  setNavigation: (id: string, preference: NavigationPreference | undefined) => void
}

function persist(state: PreferencesState) {
  if (state.userId !== null) preferencesStorage.save(state.userId, { mutedNotices: state.mutedNotices, defaultSpace: state.defaultSpace, navigation: state.navigation })
}

export const usePreferencesStore = create<PreferencesState>((set, get) => ({
  ...emptyPreferences(),
  userId: null,
  loadFor: (userId) => set({ userId, ...(userId === null ? emptyPreferences() : preferencesStorage.load(userId)) }),
  setDefaultSpace: (defaultSpace) => { set({ defaultSpace }); persist(get()) },
  setNavigation: (id, preference) => {
    set((state) => ({ navigation: preference ? { ...state.navigation, [id]: preference } : Object.fromEntries(Object.entries(state.navigation).filter(([key]) => key !== id)) }))
    persist(get())
  },
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
