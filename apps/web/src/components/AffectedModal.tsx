import { Alert, Button, Modal } from 'react-bootstrap'
import type { Commitment } from '../types/availability'
import { CommitmentList } from './CommitmentList'

type AffectedModalProps = {
  organizationId: number
  timezone: string
  title: string
  // O que acabou de acontecer, em uma frase (ex.: "Veículo ABC1D23 bloqueado")
  summary: string
  commitments: Commitment[]
  externalCount?: number
  onClose: () => void
}

// Mostrado depois de bloquear, inativar ou mudar validade: lista o que ficou afetado. Não cancela nada sozinho.
export function AffectedModal({ organizationId, timezone, title, summary, commitments, externalCount = 0, onClose }: AffectedModalProps) {
  return (
    <Modal show onHide={onClose} centered size="xl" fullscreen="lg-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          {title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-3">{summary}</p>
        <Alert variant="warning" className="d-flex gap-2">
          <i className="bi bi-exclamation-triangle-fill" aria-hidden="true" />
          <div>
            <strong>
              {commitments.length} {commitments.length === 1 ? 'compromisso futuro afetado' : 'compromissos futuros afetados'}.
            </strong>{' '}
            Nada foi cancelado: escolha uma providência para cada item abaixo. Você também pode resolver depois, pelo detalhe do veículo ou do instrutor.
          </div>
        </Alert>
        {externalCount > 0 && (
          <Alert variant="info" className="small">
            O instrutor também tem {externalCount} {externalCount === 1 ? 'compromisso' : 'compromissos'} em outros espaços nesse período. Por privacidade, os detalhes não aparecem aqui: avise-o para combinar com cada espaço.
          </Alert>
        )}
        <CommitmentList organizationId={organizationId} timezone={timezone} commitments={commitments} canAct />
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose}>Fechar</Button>
      </Modal.Footer>
    </Modal>
  )
}
