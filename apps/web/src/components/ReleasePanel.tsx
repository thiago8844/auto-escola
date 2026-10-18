import { Alert } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { CHECKLIST_TYPE_LABELS } from '../config/domain'
import type { PracticeRelease } from '../types/enrollment'

type ReleasePanelProps = {
  release: PracticeRelease
  // Link para o processo (só a equipe vê o checklist)
  processLink?: string
}

// Mostra se a prática está liberada e o que falta, sem laudos nem notas
export function ReleasePanel({ release, processLink }: ReleasePanelProps) {
  if (release.released) {
    return (
      <Alert variant="success" className="mb-0">
        <i className="bi bi-check-circle-fill me-2" aria-hidden="true" />
        Prática liberada: todos os itens obrigatórios do checklist estão conferidos.
      </Alert>
    )
  }

  return (
    <Alert variant="warning" className="mb-0">
      <p className="fw-semibold mb-2">
        <i className="bi bi-lock-fill me-2" aria-hidden="true" />
        Prática bloqueada: faltam itens obrigatórios do checklist
      </p>
      <ul className="mb-2">
        {release.pending.map((type) => (
          <li key={type}>{CHECKLIST_TYPE_LABELS[type]}</li>
        ))}
      </ul>
      <p className="small mb-0">
        Aulas podem ser agendadas, mas só podem ser concluídas depois da liberação.
        {processLink && (
          <>
            {' '}
            <Link to={processLink}>Abrir o checklist</Link>
          </>
        )}
      </p>
    </Alert>
  )
}
