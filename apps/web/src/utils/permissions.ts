import type { Role } from '../types/organization'

// Espelha docs/permissoes.md. A API é quem decide de fato; aqui só evitamos oferecer ações que seriam negadas.

const ADMIN_MANAGEABLE: Role[] = ['staff', 'instructor']

export function canEditOrganization(role: Role): boolean {
  return role === 'owner' || role === 'admin'
}

export function canManageMembers(role: Role): boolean {
  return role === 'owner' || role === 'admin'
}

// Papéis que o usuário pode conceder (em convites e na troca de papel)
export function assignableRoles(actor: Role): Role[] {
  if (actor === 'owner') return ['owner', 'admin', 'staff', 'instructor']
  if (actor === 'admin') return ADMIN_MANAGEABLE
  return []
}

// Gestor só mexe em equipe e instrutores; proprietário mexe em qualquer um
export function canManageMember(actor: Role, target: Role): boolean {
  if (actor === 'owner') return true
  if (actor === 'admin') return ADMIN_MANAGEABLE.includes(target)
  return false
}

// Cadastros e agenda do espaço (alunos, matrículas, processos): owner, admin e staff
export function canOperate(role: Role): boolean {
  return role === 'owner' || role === 'admin' || role === 'staff'
}
