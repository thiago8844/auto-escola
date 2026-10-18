import { Suspense } from 'react'
import { FullPageSpinner } from './FullPageSpinner'
import { FormNavigationGuard } from './FormNavigationGuard'
import { AuthGate } from './AuthGate'
import { CriticalAlertHost } from './CriticalAlertHost'
import { ToastHost } from './ToastHost'

// Raiz das rotas: sessão + camada de avisos (toasts e alerta máximo), que ficam acima de qualquer tela
export function RootLayout() {
  return (
    <>
      <Suspense fallback={<FullPageSpinner />}><AuthGate /></Suspense>
      <FormNavigationGuard />
      <ToastHost />
      <CriticalAlertHost />
    </>
  )
}
