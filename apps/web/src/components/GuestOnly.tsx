import { Navigate, Outlet, useLocation, type Location } from 'react-router-dom'
import { paths } from '../config/paths'
import { useAuthStore } from '../stores/authStore'

// Login e cadastro só para quem não está logado; quem já entrou vai ao destino de origem
export function GuestOnly() {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status === 'authenticated') {
    const from = (location.state as { from?: Location } | null)?.from
    return <Navigate to={from ?? paths.home} replace />
  }
  return <Outlet />
}
