import type { InvitationStatus, OrganizationType, Role } from '../types/organization'

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Proprietário',
  admin: 'Gestor',
  staff: 'Equipe',
  instructor: 'Instrutor',
}

export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  cfc: 'CFC (autoescola)',
  independent: 'Particular (instrutor autônomo)',
}

// Cor sempre acompanhada de texto e ícone
export const INVITATION_STATUS: Record<InvitationStatus, { label: string; bg: string; icon: string }> = {
  pending: { label: 'Pendente', bg: 'warning', icon: 'bi-hourglass-split' },
  accepted: { label: 'Aceito', bg: 'success', icon: 'bi-check-circle-fill' },
  revoked: { label: 'Cancelado', bg: 'secondary', icon: 'bi-x-circle' },
  expired: { label: 'Expirado', bg: 'secondary', icon: 'bi-clock-history' },
}

// Listagens da API são paginadas (padrão 15, máximo 100)
export const LIST_PAGE_SIZE = 100
