import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NOTICE_TYPES, TOAST_FADE_AFTER_MS } from '../config/notices'
import { usePreferencesStore } from '../stores/preferencesStore'
import { useToastStore } from '../stores/toastStore'
import type { ToastData } from '../types/notice'

const LEAVE_MS = 200

// Um balão de aviso. `auto` mostra uma barra de tempo e fecha sozinho (pausa com o mouse ou o foco);
// `sticky` só fecha no X e, se ninguém tocar nele em 5 segundos, fica mais transparente.
export function ToastItem({ toast }: { toast: ToastData }) {
  const remove = useToastStore((state) => state.remove)
  const mute = usePreferencesStore((state) => state.mute)
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)
  const [faded, setFaded] = useState(false)
  const [touched, setTouched] = useState(false)
  const type = NOTICE_TYPES[toast.type]

  const close = () => {
    setLeaving(true)
    setTimeout(() => remove(toast.id), LEAVE_MS)
  }

  useEffect(() => {
    if (toast.mode !== 'sticky' || touched) return
    const timer = setTimeout(() => setFaded(true), TOAST_FADE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [toast.mode, touched])

  const acknowledge = () => {
    setTouched(true)
    setFaded(false)
  }

  const runAction = () => {
    toast.action?.onClick?.()
    if (toast.action?.to) navigate(toast.action.to)
    close()
  }

  // Erro e alerta interrompem o leitor de tela; o resto é anunciado com calma
  const role = toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'

  return (
    <div
      role={role}
      className={`toast-card toast-${toast.type}${leaving ? ' is-leaving' : ''}${faded ? ' is-faded' : ''}`}
      onMouseEnter={acknowledge}
      onFocus={acknowledge}
    >
      <span className="toast-icon" aria-hidden="true">
        <i className={`bi ${type.icon}`} />
      </span>

      <div className="toast-content">
        <p className="toast-title">{toast.title ?? type.label}</p>
        <p className="toast-message">{toast.message}</p>
        {(toast.action || toast.muteKey) && (
          <div className="toast-actions">
            {toast.action && (
              <button type="button" className="toast-link" onClick={runAction}>
                {toast.action.label}
              </button>
            )}
            {toast.muteKey && (
              <button
                type="button"
                className="toast-link toast-link-muted"
                onClick={() => {
                  mute(toast.muteKey!)
                  close()
                }}
              >
                Não mostrar novamente
              </button>
            )}
          </div>
        )}
      </div>

      <button type="button" className="toast-close" aria-label="Fechar aviso" onClick={close}>
        <i className="bi bi-x-lg" aria-hidden="true" />
      </button>

      {toast.mode === 'auto' && <span className="toast-progress" style={{ animationDuration: `${toast.duration}ms` }} onAnimationEnd={close} aria-hidden="true" />}
    </div>
  )
}
