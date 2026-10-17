import { API_URL } from '../config'

export type ApiStatus = 'online' | 'offline'

// O health check do Laravel (/up) fica fora de api/*, então não recebe o header de CORS.
// Com mode 'no-cors' a resposta é opaca, mas basta saber que o servidor respondeu:
// se a requisição resolver, a API está no ar; se falhar na rede, está offline.
export async function checkApiHealth(): Promise<ApiStatus> {
  try {
    await fetch(`${API_URL}/up`, { mode: 'no-cors', cache: 'no-store' })
    return 'online'
  } catch {
    return 'offline'
  }
}
