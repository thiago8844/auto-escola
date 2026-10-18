// Tema claro/escuro. A escolha fica só neste navegador (conveniência), nunca é enviada à API.
export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'rc-theme'

export function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  } catch {
    // Armazenamento indisponível (janela privada, bloqueado): segue o sistema
  }
  return 'system'
}

export function storeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, mode)
  } catch {
    // Sem armazenamento, o tema vale só até recarregar
  }
}

export function systemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === 'system' ? systemTheme() : mode
}

// O Bootstrap 5.3 troca as cores pelo atributo data-bs-theme no <html>
export function applyTheme(theme: ResolvedTheme) {
  document.documentElement.setAttribute('data-bs-theme', theme)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0f1a21' : '#f5f7fa')
}
