import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Field = { label: string; value: ReactNode }

// Conteúdo do resumo que abre ao tocar numa linha da listagem: dados que não cabem na tabela
// e o botão que leva à ficha completa (campos vazios ficam de fora)
export function RecordPreview({ fields, to, action }: { fields: Field[]; to: string; action: string }) {
  const filled = fields.filter((f) => f.value !== null && f.value !== undefined && f.value !== '' && f.value !== false)
  return (
    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3">
      {filled.length > 0 ? (
        <dl className="row small mb-0 flex-grow-1">
          {filled.map((f) => (
            <div key={f.label} className="col-sm-6 col-lg-4 mb-1">
              <dt className="fw-normal text-secondary">{f.label}</dt>
              <dd className="mb-0 text-break">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="small text-secondary mb-0 flex-grow-1">Sem mais informações cadastradas.</p>
      )}
      <Link to={to} className="btn btn-outline-primary btn-sm flex-shrink-0">
        {action} <i className="bi bi-arrow-right ms-1" aria-hidden="true" />
      </Link>
    </div>
  )
}
