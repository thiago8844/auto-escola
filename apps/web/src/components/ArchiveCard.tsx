import { useState } from 'react'
import { Button, Card } from 'react-bootstrap'
import { ConfirmModal } from './ConfirmModal'

type ArchiveCardProps = {
  // "aluno", "veículo", "parceiro"
  noun: string
  name: string
  // O que acontece com o histórico e com dados que continuam reservados (CPF, placa)
  consequences: string
  pending: boolean
  onArchive: () => void
}

// Arquivar tira o cadastro da operação sem apagar histórico. Sempre explica o que muda antes de confirmar.
export function ArchiveCard({ noun, name, consequences, pending, onArchive }: ArchiveCardProps) {
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <Card className="mt-4">
        <Card.Body>
          <Card.Title as="h2" className="h5">
            Arquivar {noun}
          </Card.Title>
          <p className="small text-secondary">{consequences}</p>
          <Button variant="outline-danger" className="w-100" onClick={() => setConfirming(true)}>
            <i className="bi bi-archive me-2" aria-hidden="true" />
            Arquivar {noun}
          </Button>
        </Card.Body>
      </Card>

      <ConfirmModal
        show={confirming}
        title={`Arquivar ${noun}`}
        confirmLabel="Arquivar"
        pending={pending}
        onConfirm={() => {
          onArchive()
          setConfirming(false)
        }}
        onCancel={() => setConfirming(false)}
      >
        <strong className="text-break">{name}</strong> sai das listas e das opções de agendamento. {consequences}
      </ConfirmModal>
    </>
  )
}
