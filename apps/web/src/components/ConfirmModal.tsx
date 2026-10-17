import type { ReactNode } from 'react'
import { Button, Modal, Spinner } from 'react-bootstrap'

type ConfirmModalProps = {
  show: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  pending?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({ show, title, children, confirmLabel, pending, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>{children}</Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={pending}>
          {pending && <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />}
          {confirmLabel}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
