import { Badge } from 'react-bootstrap'
import { SITUATION } from '../../config/finance'
import type { Situation } from '../../types/finance'
import { formatCents } from '../../utils/money'

export function SituationBadge({ situation, pendingCents = 0 }: { situation: Situation | null; pendingCents?: number }) {
  if (!situation) return null
  const { label, bg, icon } = SITUATION[situation]
  return (
    <span className="d-inline-flex flex-column gap-1 align-items-start">
    <Badge bg={bg} text={bg === 'warning' ? 'dark' : undefined}>
      <i className={`bi ${icon} me-1`} aria-hidden="true" />
      {pendingCents > 0 && situation === 'paid' ? 'Quitada' : label}
    </Badge>
    {pendingCents > 0 && <span className="small text-warning-emphasis"><i className="bi bi-hourglass-split me-1" aria-hidden="true" />{formatCents(pendingCents)} aguardando liquidação</span>}
    </span>
  )
}

export function Money({ cents, strong, tone }: { cents: number; strong?: boolean; tone?: 'danger' | 'success' | 'secondary' }) {
  return <span className={`tabular-nums${strong ? ' fw-semibold' : ''}${tone ? ` text-${tone}` : ''}`}>{formatCents(cents)}</span>
}
