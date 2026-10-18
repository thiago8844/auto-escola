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
export const PAGE_SIZE = 15
// Lista de espaços sem paginação na tela: o usuário tem poucos, e a tela de criação precisa de todos
export const LIST_PAGE_SIZE = 100

// Fusos do Brasil (a API aceita qualquer fuso IANA; estes cobrem o país)
export const TIMEZONES: Array<{ value: string; label: string }> = [
  { value: 'America/Sao_Paulo', label: 'Brasília (São Paulo, Rio, Belo Horizonte)' },
  { value: 'America/Bahia', label: 'Bahia' },
  { value: 'America/Fortaleza', label: 'Fortaleza' },
  { value: 'America/Recife', label: 'Recife' },
  { value: 'America/Belem', label: 'Belém' },
  { value: 'America/Maceio', label: 'Maceió' },
  { value: 'America/Araguaina', label: 'Araguaína' },
  { value: 'America/Cuiaba', label: 'Cuiabá' },
  { value: 'America/Campo_Grande', label: 'Campo Grande' },
  { value: 'America/Manaus', label: 'Manaus' },
  { value: 'America/Porto_Velho', label: 'Porto Velho' },
  { value: 'America/Boa_Vista', label: 'Boa Vista' },
  { value: 'America/Rio_Branco', label: 'Rio Branco' },
  { value: 'America/Noronha', label: 'Fernando de Noronha' },
]
