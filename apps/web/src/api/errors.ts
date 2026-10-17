import { isAxiosError } from 'axios'
import type { ApiErrorBody } from '../types/api'

export type ApiErrorKind =
  | 'network'
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'server'
  | 'unknown'

const GENERIC_MESSAGES: Record<ApiErrorKind, string> = {
  network: 'Não foi possível conectar à API. Verifique sua conexão e tente novamente.',
  validation: 'Verifique os campos informados.',
  unauthenticated: 'Sua sessão expirou. Entre novamente.',
  forbidden: 'Você não tem permissão para realizar esta ação.',
  not_found: 'Registro não encontrado.',
  rate_limited: 'Muitas tentativas. Aguarde um instante e tente novamente.',
  server: 'Algo deu errado do nosso lado. Tente novamente em instantes.',
  unknown: 'Não foi possível concluir a ação. Tente novamente.',
}

// Mensagens por código estável da API. Têm prioridade sobre o texto do servidor.
const CODE_MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  invalid_verification_link: 'Link de confirmação inválido ou expirado.',
}

function kindFromStatus(status: number | undefined): ApiErrorKind {
  if (status === undefined) return 'network'
  if (status === 401) return 'unauthenticated'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 422) return 'validation'
  if (status === 429) return 'rate_limited'
  if (status >= 500) return 'server'
  return 'unknown'
}

// Primeiro erro de cada campo, no formato { campo: 'mensagem' }
function firstFieldErrors(errors: ApiErrorBody['errors']): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [field, messages] of Object.entries(errors ?? {})) {
    if (messages[0]) result[field] = messages[0]
  }
  return result
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly code?: string
  readonly fieldErrors: Record<string, string>

  constructor(init: {
    kind: ApiErrorKind
    message: string
    status?: number
    code?: string
    fieldErrors?: Record<string, string>
  }) {
    super(init.message)
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status
    this.code = init.code
    this.fieldErrors = init.fieldErrors ?? {}
  }
}

// Converte qualquer falha em ApiError. Nunca repassa texto do servidor em erros 5xx
// (pode conter detalhes internos) nem mensagens sem código estável em 401/403.
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (!isAxiosError<ApiErrorBody>(error)) {
    return new ApiError({ kind: 'unknown', message: GENERIC_MESSAGES.unknown })
  }

  const status = error.response?.status
  const body = error.response?.data
  const kind = kindFromStatus(status)
  const code = body?.error
  const fieldErrors = kind === 'validation' ? firstFieldErrors(body?.errors) : {}

  let message = GENERIC_MESSAGES[kind]
  if (code && CODE_MESSAGES[code]) {
    message = CODE_MESSAGES[code]
  } else if (code && body?.message && (kind === 'forbidden' || kind === 'unknown')) {
    message = body.message
  } else if (kind === 'validation' && body?.message && Object.keys(fieldErrors).length === 0) {
    message = body.message
  }

  return new ApiError({ kind, message, status, code, fieldErrors })
}
