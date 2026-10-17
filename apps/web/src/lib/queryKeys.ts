// Tudo de um espaço fica sob ['organizations', id, ...]: invalidar ['organizations'] atualiza tudo
export const queryKeys = {
  organizations: {
    all: ['organizations'] as const,
    detail: (id: number | string) => ['organizations', String(id)] as const,
    members: (id: number | string, page: number) => ['organizations', String(id), 'members', page] as const,
    invitations: (id: number | string, page: number) => ['organizations', String(id), 'invitations', page] as const,
    // Prefixo sem página: invalida todas as páginas da lista
    invitationsAll: (id: number | string) => ['organizations', String(id), 'invitations'] as const,
  },
}
