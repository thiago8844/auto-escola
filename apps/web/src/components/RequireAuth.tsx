import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { paths } from '../config/paths'
import { useAuthStore } from '../stores/authStore'

// Bloqueia rotas sem login e guarda o destino para voltar depois de entrar
export function RequireAuth() {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status !== 'authenticated') {
    return <Navigate to={paths.login} replace state={{ from: location }} />
  }
  return <Outlet />
}
