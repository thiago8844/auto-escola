import { create } from 'zustand'
import { applyTheme, readStoredMode, resolveTheme, storeMode, type ThemeMode } from '../lib/theme'

type ThemeState = {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: readStoredMode(),
  setMode: (mode) => {
    storeMode(mode)
    applyTheme(resolveTheme(mode))
    set({ mode })
  },
}))

// Chamado uma vez na inicialização: aplica o tema e acompanha o sistema enquanto o modo for "system"
export function initTheme() {
  applyTheme(resolveTheme(useThemeStore.getState().mode))
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().mode === 'system') applyTheme(resolveTheme('system'))
  })
}
