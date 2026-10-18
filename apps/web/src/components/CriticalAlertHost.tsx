import { useState } from 'react'
import { Button, Form, Modal } from 'react-bootstrap'
import { useNavigate } from 'react-router-dom'
import { CRITICAL_ICON } from '../config/notices'
import { useCriticalStore } from '../stores/criticalStore'
import type { CriticalAlert } from '../types/notice'

// Alerta máximo: modal sem X, sem fechar ao clicar fora nem com Esc. Só some quando o usuário confirma.
// Se houver vários, aparecem um de cada vez.
export function CriticalAlertHost() {
  const alert = useCriticalStore((state) => state.queue[0])
  // `key` reinicia a caixa "não mostrar novamente" a cada alerta
  return alert ? <CriticalModal key={alert.id} alert={alert} /> : null
}

function CriticalModal({ alert }: { alert: CriticalAlert }) {
  const acknowledge = useCriticalStore((state) => state.acknowledge)
  const navigate = useNavigate()
  const [mute, setMute] = useState(false)
  const severity = alert.severity ?? 'danger'

  const confirm = () => acknowledge(alert.id, { mute })
  const runAction = () => {
    alert.action?.onClick?.()
    if (alert.action?.to) navigate(alert.action.to)
    acknowledge(alert.id, { mute })
  }

  return (
    <Modal show centered backdrop="static" keyboard={false} aria-labelledby="critical-title" contentClassName={`critical-modal critical-${severity}`}>
      <Modal.Body className="p-4">
        <div className="d-flex gap-3">
          <span className="critical-icon" aria-hidden="true">
            <i className={`bi ${CRITICAL_ICON}`} />
          </span>
          <div className="min-w-0">
            <h2 id="critical-title" className="h4 mb-2">
              {alert.title}
            </h2>
            <p className="mb-0">{alert.message}</p>
            {alert.details && alert.details.length > 0 && (
              <ul className="mt-3 mb-0">
                {alert.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {alert.muteKey && <Form.Check type="checkbox" id="critical-mute" className="mt-4" label="Não mostrar novamente" checked={mute} onChange={(event) => setMute(event.target.checked)} />}
      </Modal.Body>
      <Modal.Footer className="flex-column flex-sm-row-reverse">
        <Button variant={severity === 'danger' ? 'danger' : 'primary'} className="w-100 w-sm-auto" onClick={confirm} autoFocus>
          {alert.confirmLabel ?? 'Entendi'}
        </Button>
        {alert.action && (
          <Button variant="outline-secondary" className="w-100" onClick={runAction}>
            {alert.action.label}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
