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

function notifyGlobalError(error: ApiError) {
  // 422 e 401 de credencial são tratados pelas telas; 404 também
  if (error.kind === 'forbidden' || error.kind === 'rate_limited' || error.kind === 'server' || error.kind === 'network') {
    notify.error(error.message)
  }
}

http.interceptors.response.use(
  (response) => response,
  (rawError: unknown) => {
    const error = toApiError(rawError)
    const config = axios.isAxiosError(rawError) ? rawError.config : undefined

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
