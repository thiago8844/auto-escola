import { AuthGate } from './AuthGate'
import { CriticalAlertHost } from './CriticalAlertHost'
import { ToastHost } from './ToastHost'

// Raiz das rotas: sessão + camada de avisos (toasts e alerta máximo), que ficam acima de qualquer tela
export function RootLayout() {
  return (
    <>
      <AuthGate />
      <ToastHost />
      <CriticalAlertHost />
    </>
  )
}
