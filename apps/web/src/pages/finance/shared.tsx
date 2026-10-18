import { Badge } from 'react-bootstrap'
import { SITUATION } from '../../config/finance'
import type { Situation } from '../../types/finance'
import { formatCents } from '../../utils/money'

export function SituationBadge({ situation }: { situation: Situation | null }) {
  if (!situation) return null
  const { label, bg, icon } = SITUATION[situation]
  return (
    <Badge bg={bg} text={bg === 'warning' ? 'dark' : undefined}>
      <i className={`bi ${icon} me-1`} aria-hidden="true" />
      {label}
    </Badge>
  )
}

export function Money({ cents, strong, tone }: { cents: number; strong?: boolean; tone?: 'danger' | 'success' | 'secondary' }) {
  return <span className={`tabular-nums${strong ? ' fw-semibold' : ''}${tone ? ` text-${tone}` : ''}`}>{formatCents(cents)}</span>
}
