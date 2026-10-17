import type { LoginInput, RegisterInput } from '../schemas/auth'
import type { MessageResponse } from '../types/api'
import type { User } from '../types/auth'
import { http } from './client'

// Nas chamadas de autenticação a tela mostra o erro; sem toast global
const handledByScreen = { skipGlobalError: true } as const

export async function getCurrentUser(): Promise<User> {
  const { data } = await http.get<{ data: User }>('/auth/user', handledByScreen)
  return data.data
}

export async function login(input: LoginInput): Promise<User> {
  const { data } = await http.post<{ data: User }>('/auth/login', input, handledByScreen)
  return data.data
}

// O cadastro não abre sessão; entramos logo em seguida para permitir o reenvio do e-mail
export async function register(input: RegisterInput): Promise<User> {
  await http.post('/auth/register', input, handledByScreen)
  return login({ email: input.email, password: input.password })
}

export async function logout(): Promise<void> {
  await http.post('/auth/logout', undefined, handledByScreen)
}

export async function resendVerification(): Promise<MessageResponse> {
  const { data } = await http.post<MessageResponse>('/auth/email/verification-notification', undefined, handledByScreen)
  return data
}

// `search` é a query string do link (?expires=...&signature=...), repassada como veio
export async function verifyEmail(id: string, hash: string, search: string): Promise<MessageResponse> {
  const { data } = await http.get<MessageResponse>(
    `/auth/email/verify/${encodeURIComponent(id)}/${encodeURIComponent(hash)}${search}`,
    handledByScreen,
  )
  return data
}
