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
  role_not_assignable_by_admin: 'Gestores só podem gerenciar membros com papel de equipe ou instrutor.',
  last_owner: 'O espaço precisa ter ao menos um proprietário.',
  independent_space_exists: 'Você já possui um espaço particular.',
  already_member: 'Esta pessoa já tem acesso ao espaço.',
  invitation_already_pending: 'Já existe um convite pendente para este e-mail.',
  invitation_not_found: 'Convite não encontrado. Confira o link recebido por e-mail.',
  invitation_already_used: 'Este convite já foi usado.',
  invitation_revoked: 'Este convite foi cancelado pela equipe do espaço.',
  invitation_expired: 'Este convite expirou. Peça um novo à equipe do espaço.',
  invitation_recipient_mismatch: 'Este convite foi enviado para outro e-mail. Entre com a conta do e-mail convidado.',
  instructor_identity_locked: 'Este instrutor tem conta própria: só ele altera nome, credencial e categorias, no próprio perfil.',
  instructor_unavailable: 'Instrutor indisponível nesse horário. Ele pode ter aula em outro espaço.',
  vehicle_unavailable: 'Veículo já ocupado por outra aula nesse horário.',
  student_unavailable: 'O aluno já tem aula agendada nesse horário.',
  enrollment_closed: 'Matrícula encerrada ou rescindida não aceita novas aulas.',
  vehicle_inactive: 'O veículo escolhido está inativo.',
  vehicle_document_expired: 'O CRLV do veículo vence antes do dia da aula.',
  vehicle_category_mismatch: 'A categoria do veículo não é coberta pela categoria da matrícula.',
  instructor_category_mismatch: 'O instrutor não tem a categoria desse veículo cadastrada.',
  invalid_status_transition: 'Esta aula não pode mudar para essa situação.',
  lesson_not_completed: 'Evolução, duração real e registro oficial só valem para aula realizada.',
  registry_evidence_required: 'Para confirmar o registro oficial, informe o protocolo ou referência.',
  email_not_verified: 'Confirme seu e-mail antes de aceitar o convite.',
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

// A API devolve as mensagens de validação do Laravel em inglês. Traduzimos os padrões mais comuns;
// o que não casar segue como veio (a validação do formulário no navegador cobre quase tudo antes).
const VALIDATION_TRANSLATIONS: Array<[RegExp, string]> = [
  [/must not be greater than (\d+) kilobytes/i, 'O arquivo é maior que o limite permitido.'],
  [/must be a file of type/i, 'Tipo de arquivo não permitido. Use PDF, JPG, PNG ou WebP.'],
  [/must be a file/i, 'Escolha um arquivo.'],
  [/failed to upload/i, 'Não foi possível enviar o arquivo. Ele pode ser maior que o limite do servidor.'],
  [/has already been taken/i, 'Este valor já está em uso.'],
  [/field is required/i, 'Campo obrigatório.'],
  [/must be a valid email/i, 'Informe um e-mail válido.'],
  [/must be at least (\d+) characters/i, 'Muito curto.'],
  [/must not be greater than (\d+) characters/i, 'Muito longo.'],
  [/confirmation does not match/i, 'A confirmação não confere.'],
  [/must be a date before/i, 'A data deve ser anterior à permitida.'],
  [/must be a date after/i, 'A data deve ser posterior à permitida.'],
  [/selected .* is invalid/i, 'Opção inválida.'],
  [/must be a valid timezone/i, 'Fuso horário inválido.'],
]

export function translateValidationMessage(message: string): string {
  return VALIDATION_TRANSLATIONS.find(([pattern]) => pattern.test(message))?.[1] ?? message
}

// Primeiro erro de cada campo, no formato { campo: 'mensagem' }
function firstFieldErrors(errors: ApiErrorBody['errors']): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [field, messages] of Object.entries(errors ?? {})) {
    if (messages[0]) result[field] = translateValidationMessage(messages[0])
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
