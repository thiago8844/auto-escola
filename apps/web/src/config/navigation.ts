import type { NavItemProps } from '../components/NavItem'
import type { NavigationPreference } from '../lib/preferencesStorage'
import type { Organization, Role } from '../types/organization'
import { canManageMembers, canOperate } from '../utils/permissions'
import { organizationPaths, paths } from './paths'

export type NavigationModule = NavItemProps & { id: string; group: 'Operação' | 'Cadastros' | 'Gestão' | 'Pessoal' }

export function organizationNavigation(organization: Organization): NavigationModule[] {
  const links = organizationPaths(organization.id)
  const operate = canOperate(organization.role)
  return [
    { id: 'home', to: links.home, icon: 'bi-house', label: 'Início', end: true, group: 'Operação' },
    { id: 'schedule', to: links.schedule, icon: 'bi-calendar-week', label: organization.role === 'instructor' ? 'Minhas aulas neste espaço' : 'Agenda', group: 'Operação' },
    { id: 'students', to: links.students, icon: 'bi-mortarboard', label: 'Alunos', group: 'Operação' },
    { id: 'alerts', to: links.alerts, icon: 'bi-bell', label: 'Pendências', group: 'Operação' },
    { id: 'availability', to: links.availability, icon: 'bi-slash-circle', label: operate ? 'Bloqueios e manutenção' : 'Minha indisponibilidade', group: 'Operação' },
    { id: 'enrollments', to: links.enrollments, icon: 'bi-journal-text', label: 'Matrículas', group: 'Cadastros' },
    { id: 'exams', to: links.exams, icon: 'bi-clipboard-check', label: 'Exames', group: 'Operação' },
    { id: 'vehicles', to: links.vehicles, icon: 'bi-car-front', label: 'Veículos', group: 'Cadastros' },
    ...(operate ? [
      { id: 'finance', to: links.finance, icon: 'bi-cash-coin', label: 'Financeiro', group: 'Gestão' as const },
      { id: 'reports', to: links.reports, icon: 'bi-bar-chart-line', label: 'Relatórios', group: 'Gestão' as const },
      { id: 'instructors', to: links.instructors, icon: 'bi-person-badge', label: 'Instrutores', group: 'Cadastros' as const },
      { id: 'partners', to: links.partners, icon: 'bi-building', label: 'Parceiros', group: 'Cadastros' as const },
      { id: 'processes', to: links.processes, icon: 'bi-diagram-3', label: 'Processos', group: 'Operação' as const },
    ] : []),
    ...(canManageMembers(organization.role) ? [
      { id: 'members', to: links.members, icon: 'bi-people', label: 'Membros', group: 'Gestão' as const },
      { id: 'invitations', to: links.invitations, icon: 'bi-envelope-plus', label: 'Convites', group: 'Gestão' as const },
      { id: 'audit', to: links.audit, icon: 'bi-shield-check', label: 'Auditoria', group: 'Gestão' as const },
    ] : []),
    { id: 'settings', to: links.settings, icon: 'bi-gear', label: 'Dados do espaço', group: 'Gestão' },
    { id: 'personalAgenda', to: paths.myLessons, icon: 'bi-calendar-check', label: 'Agenda entre espaços', group: 'Pessoal' },
  ]
}

export function defaultModuleOrder(role: Role): string[] {
  if (role === 'instructor') return ['home', 'schedule', 'students', 'alerts', 'availability']
  if (role === 'staff') return ['home', 'students', 'schedule', 'alerts', 'finance']
  return ['home', 'schedule', 'alerts', 'finance', 'reports']
}

export function arrangeNavigation(modules: NavigationModule[], role: Role, preference?: NavigationPreference) {
  const ids = [...new Set([...(preference?.order ?? defaultModuleOrder(role)), ...modules.map((m) => m.id)])]
  const ordered = ids.flatMap((id) => modules.find((m) => m.id === id) ?? [])
  const hidden = new Set((preference?.hidden ?? []).filter((id) => id !== 'home' && id !== 'alerts'))
  const visible = ordered.filter((m) => !hidden.has(m.id))
  return { ordered, hidden, primary: visible.slice(0, 5), secondary: visible.slice(5) }
}
