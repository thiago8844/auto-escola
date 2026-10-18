import axios from 'axios'
import { API_BASE_URL, API_URL } from '../config'
import { resetServerCache } from '../lib/queryClient'
import { useAuthStore } from '../stores/authStore'
import { notify } from '../stores/toastStore'
import { ApiError, toApiError } from './errors'

export const http = axios.create({
  baseURL: API_BASE_URL,
  headers: { Accept: 'application/json' },
  // Sessão por cookie do Sanctum; o axios devolve o XSRF-TOKEN no header X-XSRF-TOKEN
  withCredentials: true,
  withXSRFToken: true,
})

const SAFE_METHODS = ['get', 'head', 'options']
let csrfRequest: Promise<unknown> | null = null

function hasCsrfCookie() {
  return document.cookie.split('; ').some((cookie) => cookie.startsWith('XSRF-TOKEN='))
}

// O Sanctum exige o cookie CSRF antes de qualquer requisição que altera dados
http.interceptors.request.use(async (config) => {
  const method = (config.method ?? 'get').toLowerCase()
  if (SAFE_METHODS.includes(method) || hasCsrfCookie()) return config

  csrfRequest ??= axios
    .get(`${API_URL}/sanctum/csrf-cookie`, { withCredentials: true })
    .finally(() => {
      csrfRequest = null
    })
  await csrfRequest
  return config
})

// --- Duplo envio e falha de rede ---------------------------------------------------------------------------
// Toda alteração dentro de um espaço leva uma `Idempotency-Key`. Dois cliques seguidos viram UMA requisição
// (a segunda espera a primeira). Se a resposta se perde na rede, o reenvio reutiliza a mesma chave e a API
// devolve o resultado já gravado em vez de repetir a ação. Qualquer resposta da API encerra a chave.
const MUTATING = ['post', 'put', 'patch', 'delete']
const keyByFingerprint = new Map<string, string>()
const inFlight = new Map<string, Promise<unknown>>()

function isGuarded(config: { method?: string; url?: string }) {
  return MUTATING.includes((config.method ?? 'get').toLowerCase()) && (config.url ?? '').includes('/organizations/')
}

function fingerprintOf(config: { method?: string; url?: string; data?: unknown }) {
  const data = config.data
  const body =
    data instanceof FormData
      ? [...data.entries()].map(([name, value]) => `${name}=${value instanceof File ? `${value.name}:${value.size}` : String(value)}`).join('&')
      : typeof data === 'string'
        ? data
        : JSON.stringify(data ?? null)
  return `${(config.method ?? 'get').toLowerCase()}|${config.url}|${body}`
}

const defaultAdapter = axios.getAdapter(http.defaults.adapter)
http.defaults.adapter = (config) => {
  if (!isGuarded(config)) return defaultAdapter(config)

  const fingerprint = fingerprintOf(config)
  const running = inFlight.get(fingerprint)
  if (running) return running as ReturnType<typeof defaultAdapter>

  const request = defaultAdapter(config).finally(() => inFlight.delete(fingerprint))
  inFlight.set(fingerprint, request)
  return request
}

http.interceptors.request.use((config) => {
  if (!isGuarded(config)) return config

  const fingerprint = fingerprintOf(config)
  let key = keyByFingerprint.get(fingerprint)
  if (!key) {
    key = crypto.randomUUID()
    keyByFingerprint.set(fingerprint, key)
  }
  config.headers.set('Idempotency-Key', key)
  return config
})

function notifyGlobalError(error: ApiError) {
  // 422 e 401 de credencial são tratados pelas telas; 404 também
  if (error.kind === 'forbidden' || error.kind === 'rate_limited' || error.kind === 'server' || error.kind === 'network') {
    notify.error(error.message)
  }
}

http.interceptors.response.use(
  (response) => {
    keyByFingerprint.delete(fingerprintOf(response.config))
    return response
  },
  (rawError: unknown) => {
    const error = toApiError(rawError)
    const config = axios.isAxiosError(rawError) ? rawError.config : undefined

    // Com resposta da API a tentativa terminou; sem resposta (rede), a chave fica para o reenvio
    if (config && axios.isAxiosError(rawError) && rawError.response) keyByFingerprint.delete(fingerprintOf(config))

    // 401 com a sessão ativa = sessão expirada. A rota protegida redireciona ao login.
    if (error.kind === 'unauthenticated' && useAuthStore.getState().status === 'authenticated') {
      useAuthStore.getState().expireSession()
      resetServerCache()
    } else if (!config?.skipGlobalError) {
      notifyGlobalError(error)
    }

    return Promise.reject(error)
  },
)
