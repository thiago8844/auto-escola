import { create } from 'zustand'
import type { User } from '../types/auth'

// 'unknown' vale até a primeira checagem da sessão (GET /auth/user) terminar
export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous'

type AuthState = {
  status: AuthStatus
  user: User | null
  // Verdadeiro quando a API respondeu 401 com a sessão ativa; a tela de login avisa o usuário
  sessionExpired: boolean
  setUser: (user: User) => void
  setAnonymous: () => void
  expireSession: () => void
}

// Só em memória: a sessão vive no cookie do Sanctum, nada de token em localStorage
export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  user: null,
  sessionExpired: false,
  setUser: (user) => set({ status: 'authenticated', user, sessionExpired: false }),
  setAnonymous: () => set({ status: 'anonymous', user: null, sessionExpired: false }),
  expireSession: () => set({ status: 'anonymous', user: null, sessionExpired: true }),
}))
