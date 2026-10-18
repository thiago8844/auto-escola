import { organizationPaths } from '../config/paths'
import type { AlertItem } from '../types/alert'

// Link para o registro que precisa de ação. Sem origem conhecida, abre a lista de pendências.
export function alertPath(organizationId: number, alert: Pick<AlertItem, 'subject'>): string {
  const links = organizationPaths(organizationId)
  const subject = alert.subject
  if (!subject) return links.alerts

  switch (subject.type) {
    case 'vehicle':
      return links.vehicle(subject.id)
    case 'student':
      return links.student(subject.id)
    case 'enrollment':
      return links.enrollment(subject.id)
    case 'exam':
      return links.exam(subject.id)
    case 'lesson':
      return links.lesson(subject.id)
    case 'process':
      return links.process(subject.id)
    case 'instructor':
      return links.instructor(subject.id)
    case 'receivable':
    case 'payable':
      return links.finance
    default:
      return links.alerts
  }
}
