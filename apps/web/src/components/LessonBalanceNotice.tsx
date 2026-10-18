import { Alert, Form } from 'react-bootstrap'
import type { Balance } from '../types/balance'
import { formatMinutes } from '../utils/formatMinutes'
import { BalanceBadge } from './BalanceBar'

type LessonBalanceNoticeProps = {
  balance: Balance
  // Categoria simples da aula (matrícula conjunta): usa o saldo daquela categoria
  category: string | null
  needed: number
  overrideReason: string
  onOverrideReasonChange: (value: string) => void
  overrideError?: string
}

// Disponibilidade de saldo ao agendar: avisa, mostra o resultado e pede motivo para a exceção
export function LessonBalanceNotice({ balance, category, needed, overrideReason, onOverrideReasonChange, overrideError }: LessonBalanceNoticeProps) {
  const row = category ? balance.by_category.find((c) => c.category === category) : undefined
  const available = row ? row.available : balance.available
  const scope = row ? ` da categoria ${category}` : ''
  const enough = available >= needed

  if (!balance.has_package) {
    return (
      <Alert variant="secondary" className="small">
        <i className="bi bi-info-circle me-2" aria-hidden="true" />
        Matrícula sem pacote: esta será uma aula avulsa, sem desconto do pacote.
      </Alert>
    )
  }

  return (
    <div className={`rounded border p-3 mb-3 ${enough ? 'border-success-subtle' : 'border-warning'}`} role="status">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
        <span className="fw-semibold">Minutos para agendar{scope}</span>
        <BalanceBadge available={available} hasPackage />
      </div>
      {needed > 0 && (
        <p className="small mb-0 mt-2 tabular-nums">
          Esta aula reserva {formatMinutes(needed)}. {enough ? `Sobrarão ${formatMinutes(available - needed)}.` : `Faltam ${formatMinutes(needed - available)}.`}
        </p>
      )}
      {!enough && needed > 0 && (
        <div className="mt-3">
          <Alert variant="warning" className="small">
            <i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />
            Minutos disponíveis insuficientes. Contrate mais aulas ou autorize uma exceção explicando o motivo; ela fica registrada no extrato e na auditoria.
          </Alert>
          <Form.Group controlId="override_reason">
            <Form.Label>Motivo da exceção</Form.Label>
            <Form.Control value={overrideReason} onChange={(event) => onOverrideReasonChange(event.target.value)} isInvalid={!!overrideError} placeholder="Ex.: aluno pagará o acréscimo amanhã" maxLength={255} />
            <Form.Control.Feedback type="invalid">{overrideError}</Form.Control.Feedback>
          </Form.Group>
        </div>
      )}
    </div>
  )
}
