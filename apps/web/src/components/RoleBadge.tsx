import { Badge } from 'react-bootstrap'
import { ROLE_LABELS } from '../config/organization'
import type { Role } from '../types/organization'

export function RoleBadge({ role }: { role: Role }) {
  return <Badge bg={role === 'owner' ? 'primary' : 'secondary'}>{ROLE_LABELS[role]}</Badge>
}
