// Tudo de um espaço fica sob ['organizations', id, ...]: invalidar ['organizations'] atualiza tudo
export const queryKeys = {
  organizations: {
    all: ['organizations'] as const,
    detail: (id: number | string) => ['organizations', String(id)] as const,
    members: (id: number | string) => ['organizations', String(id), 'members'] as const,
    invitations: (id: number | string) => ['organizations', String(id), 'invitations'] as const,
  },
}
