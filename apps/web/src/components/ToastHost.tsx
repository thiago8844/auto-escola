import { useToastStore, visibleToasts } from '../stores/toastStore'
import { ToastItem } from './ToastItem'

// Canto superior direito. O aviso novo entra embaixo dos que já estão na tela.
export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <div className="toast-stack" role="region" aria-label="Avisos">
      {visibleToasts(toasts).map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
