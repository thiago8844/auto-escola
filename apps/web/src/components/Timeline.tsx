import { useState } from 'react'
import { Form } from 'react-bootstrap'
import { AUDIT_CATEGORIES } from '../config/domain'
import { useTimeline } from '../hooks/useOutcome'
import type { TimelineScope } from '../api/outcome'
import { formatDateTime } from '../utils/formatDateTime'
import { Pagination } from './Pagination'
import { QueryState } from './QueryState'

type TimelineProps = { organizationId: number; timezone: string; scope: TimelineScope; showFilter?: boolean; emptyMessage?: string }

// Linha do tempo paginada: quem fez o quê, quando e por quê. Os eventos nunca são editados.
export function Timeline({ organizationId, timezone, scope, showFilter = true, emptyMessage = 'Nenhum registro ainda.' }: TimelineProps) {
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const query = useTimeline(organizationId, scope, page, category || undefined)
  const categories = scope.kind === 'organization' ? AUDIT_CATEGORIES : Object.fromEntries(Object.entries(AUDIT_CATEGORIES).filter(([key]) => key !== 'access'))

  return (
    <div>
      {showFilter && (
        <Form.Group controlId={`timeline-filter-${scope.kind}`} className="mb-3 form-narrow">
          <Form.Label className="small mb-1">Filtrar por assunto</Form.Label>
          <Form.Select
            size="sm"
            value={category}
            onChange={(event) => {
              setCategory(event.target.value)
              setPage(1)
            }}
          >
            <option value="">Tudo</option>
            {Object.entries(categories).map(([value, { label }]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      )}

      <QueryState query={query} isEmpty={(d) => d.data.length === 0} empty={category ? 'Nada neste assunto.' : emptyMessage}>
        {(data) => (
          <>
            <ol className="timeline mb-3">
              {data.data.map((event) => {
                const meta = AUDIT_CATEGORIES[event.category] ?? { label: event.category, icon: 'bi-dot' }
                const details = event.changes ? Object.entries(event.changes).filter(([, value]) => value !== null && typeof value !== 'object') : []
                return (
                  <li key={event.id} className="timeline-item">
                    <span className="timeline-marker" aria-hidden="true">
                      <i className={`bi ${meta.icon}`} />
                    </span>
                    <div className="min-w-0">
                      <div className="fw-semibold text-break">{event.summary}</div>
                      <div className="small text-secondary">
                        <span className="tabular-nums">{formatDateTime(event.created_at, timezone)}</span> · {event.actor?.name ?? 'Sistema'} · {meta.label}
                      </div>
                      {event.reason && (
                        <div className="small mt-1 text-break">
                          <span className="text-secondary">Motivo:</span> {event.reason}
                        </div>
                      )}
                      {details.length > 0 && (
                        <div className="small text-secondary mt-1 text-break">
                          {details.map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
            <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} perPage={data.meta.per_page} onPageChange={setPage} />
          </>
        )}
      </QueryState>
    </div>
  )
}
