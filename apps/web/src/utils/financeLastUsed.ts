// Memória simples da última forma e conta usadas, para a baixa já abrir pronta
const storageKey = (organizationId: number, type: string) => `rc-finance-last:${organizationId}:${type}`

export function loadLastUsed(organizationId: number, type: string): { account_id?: number; method_id?: number } {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey(organizationId, type)) ?? '{}')
  } catch {
    return {}
  }
}

export function saveLastUsed(organizationId: number, type: string, value: { account_id: number; method_id: number }) {
  try {
    window.localStorage.setItem(storageKey(organizationId, type), JSON.stringify(value))
  } catch {
    // Sem armazenamento: só perde a sugestão
  }
}
