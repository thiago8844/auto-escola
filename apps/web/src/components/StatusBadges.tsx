import { Badge } from 'react-bootstrap'
import { CHECKLIST_STATUS, DOCUMENT_STATUS, ENROLLMENT_STATUS, LESSON_STATUS, PROCESS_STATUS } from '../config/domain'
import type { DocumentStatus } from '../types/document'
import type { EnrollmentStatus, PracticeRelease } from '../types/enrollment'
import type { LessonStatus } from '../types/lesson'
import type { ChecklistItemStatus, ProcessStatus } from '../types/process'

// Texto escuro sobre o amarelo, para manter o contraste
const textFor = (bg: string) => (bg === 'warning' ? 'dark' : undefined)

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  const { label, bg } = ENROLLMENT_STATUS[status]
  return <Badge bg={bg}>{label}</Badge>
}

export function ProcessStatusBadge({ status }: { status: ProcessStatus }) {
  const { label, bg } = PROCESS_STATUS[status]
  return (
    <Badge bg={bg} text={textFor(bg)}>
      {label}
    </Badge>
  )
}

export function LessonStatusBadge({ status }: { status: LessonStatus }) {
  const { label, bg, icon } = LESSON_STATUS[status]
  return (
    <Badge bg={bg} text={textFor(bg)}>
      <i className={`bi ${icon} me-1`} aria-hidden="true" />
      {label}
    </Badge>
  )
}

export function ChecklistStatusBadge({ status }: { status: ChecklistItemStatus }) {
  const { label, bg, icon } = CHECKLIST_STATUS[status]
  return (
    <Badge bg={bg} text={textFor(bg)}>
      <i className={`bi ${icon} me-1`} aria-hidden="true" />
      {label}
    </Badge>
  )
}

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const { label, bg } = DOCUMENT_STATUS[status]
  return <Badge bg={bg}>{label}</Badge>
}

// Sem processo não há checklist: a prática não é bloqueada
export function ReleaseBadge({ release }: { release?: PracticeRelease }) {
  if (!release) return <span className="text-secondary">Sem processo</span>
  return release.released ? (
    <Badge bg="success">
      <i className="bi bi-check-circle-fill me-1" aria-hidden="true" />
      Liberada
    </Badge>
  ) : (
    <Badge bg="warning" text="dark">
      <i className="bi bi-lock-fill me-1" aria-hidden="true" />
      Bloqueada
    </Badge>
  )
}
