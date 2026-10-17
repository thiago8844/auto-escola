import { Outlet } from 'react-router-dom'
import { useSessionBootstrap } from '../hooks/useSessionBootstrap'
import { useAuthStore } from '../stores/authStore'
import { ApiErrorScreen } from './ApiErrorScreen'
import { FullPageSpinner } from './FullPageSpinner'

// Raiz das rotas: só libera o app depois de saber se há sessão
export function AuthGate() {
  const status = useAuthStore((state) => state.status)
  const { error, isFetching, refetch } = useSessionBootstrap()

  if (status === 'unknown') {
    if (error) return <ApiErrorScreen error={error} retrying={isFetching} onRetry={() => void refetch()} />
    return <FullPageSpinner />
  }

  return <Outlet />
}
