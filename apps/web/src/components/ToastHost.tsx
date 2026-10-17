import { Toast, ToastContainer } from 'react-bootstrap'
import { useToastStore } from '../stores/toastStore'

// Avisos globais (403, 5xx, rede). Montado uma vez, na raiz do app.
export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)

  return (
    <ToastContainer position="top-end" className="p-3 position-fixed">
      {toasts.map((toast) => (
        <Toast key={toast.id} bg={toast.variant} autohide delay={6000} onClose={() => dismiss(toast.id)}>
          <Toast.Body className={`d-flex ${toast.variant === 'warning' ? 'text-dark' : 'text-white'}`}>
            <span className="flex-grow-1">{toast.message}</span>
            <button type="button" className={`btn-close ms-3 ${toast.variant === 'warning' ? '' : 'btn-close-white'}`} aria-label="Fechar" onClick={() => dismiss(toast.id)} />
          </Toast.Body>
        </Toast>
      ))}
    </ToastContainer>
  )
}
