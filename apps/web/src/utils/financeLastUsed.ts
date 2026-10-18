import { useAuthStore } from '../stores/authStore'

// Memória simples da última forma e conta usadas, para a baixa já abrir pronta
const storageKey = (organizationId: number, type: string) => `rc-finance-last:${useAuthStore.getState().user?.id}:${organizationId}:${type}`

export function loadLastUsed(organizationId: number, type: string): { account_id?: number; method_id?: number } {
  if (!useAuthStore.getState().user) return {}
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(organizationId, type)) ?? '{}')
  } catch {
    return {}
  }
}

export function saveLastUsed(organizationId: number, type: string, value: { account_id: number; method_id: number }) {
  if (!useAuthStore.getState().user) return
  try {
    window.localStorage.setItem(storageKey(organizationId, type), JSON.stringify(value))
  } catch {
    // Sem armazenamento: só perde a sugestão
  }
}
