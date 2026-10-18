// Onde as preferências do usuário são guardadas. Hoje: neste navegador, uma entrada por usuário.
// Quando a API tiver preferências, troque só este adaptador (load/save) por chamadas HTTP:
// o resto do app usa o preferencesStore e não muda.
export type UserPreferences = {
  // Avisos silenciados com "Não mostrar novamente": chave -> quando foi silenciado
  mutedNotices: Record<string, string>
}

export const emptyPreferences = (): UserPreferences => ({ mutedNotices: {} })

const keyFor = (userId: number) => `rc-prefs:${userId}`

export const preferencesStorage = {
  load(userId: number): UserPreferences {
    try {
      const raw = localStorage.getItem(keyFor(userId))
      if (!raw) return emptyPreferences()
      const parsed = JSON.parse(raw) as Partial<UserPreferences>
      return { ...emptyPreferences(), ...parsed }
    } catch {
      // Armazenamento indisponível ou conteúdo inválido: começa limpo
      return emptyPreferences()
    }
  },
  save(userId: number, preferences: UserPreferences) {
    try {
      localStorage.setItem(keyFor(userId), JSON.stringify(preferences))
    } catch {
      // Sem armazenamento, a preferência vale só até recarregar
    }
  },
}
