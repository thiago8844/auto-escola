export type NavigationPreference = { order: string[]; hidden: string[] }
export type UserPreferences = {
  mutedNotices: Record<string, string>
  defaultSpace: string | null
  navigation: Record<string, NavigationPreference>
}

export const emptyPreferences = (): UserPreferences => ({ mutedNotices: {}, defaultSpace: null, navigation: {} })
const keyFor = (userId: number) => `rc-prefs:${userId}`
const stringList = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string'))] : []

export const preferencesStorage = {
  load(userId: number): UserPreferences {
    try {
      const parsed = JSON.parse(localStorage.getItem(keyFor(userId)) ?? '{}') as Partial<UserPreferences> | null
      if (!parsed || typeof parsed !== 'object') return emptyPreferences()
      return {
        mutedNotices: Object.fromEntries(Object.entries(parsed.mutedNotices ?? {}).filter(([, value]) => typeof value === 'string')),
        defaultSpace: typeof parsed.defaultSpace === 'string' && /^\d+$/.test(parsed.defaultSpace) ? parsed.defaultSpace : null,
        navigation: Object.fromEntries(Object.entries(parsed.navigation ?? {}).filter(([, value]) => value && typeof value === 'object').map(([id, value]) => [id, { order: stringList(value.order), hidden: stringList(value.hidden) }])),
      }
    } catch {
      return emptyPreferences()
    }
  },
  save(userId: number, preferences: UserPreferences) {
    try { localStorage.setItem(keyFor(userId), JSON.stringify(preferences)) } catch { /* A preferência vale nesta sessão quando o navegador não permite salvar. */ }
  },
}
