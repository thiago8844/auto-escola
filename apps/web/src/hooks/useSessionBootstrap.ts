import { useQuery } from '@tanstack/react-query'
import { getCurrentUser } from '../api/auth'
import { ApiError } from '../api/errors'
import { SESSION_QUERY_KEY } from '../lib/queryClient'
import { useAuthStore } from '../stores/authStore'

// Descobre se já existe sessão (cookie válido) ao abrir o app.
// 401 vira "anônimo"; qualquer outra falha (API offline, 5xx) sobe como erro.
export function useSessionBootstrap() {
  return useQuery({
    queryKey: SESSION_QUERY_KEY,
    staleTime: Infinity,
    queryFn: async () => {
      try {
        const user = await getCurrentUser()
        useAuthStore.getState().setUser(user)
        return user
      } catch (error) {
        if (error instanceof ApiError && error.kind === 'unauthenticated') {
          useAuthStore.getState().setAnonymous()
          return null
        }
        throw error
      }
    },
  })
}
