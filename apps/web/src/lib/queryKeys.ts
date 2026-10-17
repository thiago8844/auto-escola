// Tudo de um espaço fica sob ['organizations', id, ...]: invalidar ['organizations'] atualiza tudo
export const queryKeys = {
  organizations: {
    all: ['organizations'] as const,
    detail: (id: number | string) => ['organizations', String(id)] as const,
    members: (id: number | string, page: number) => ['organizations', String(id), 'members', page] as const,
    invitations: (id: number | string, page: number) => ['organizations', String(id), 'invitations', page] as const,
    // Prefixo sem página: invalida todas as páginas da lista
    // Cadastros do espaço: a chave sempre inclui o espaço, então o cache nunca mistura espaços
    students: (id: number | string, params: object) => ['organizations', String(id), 'students', params] as const,
    student: (id: number | string, studentId: number | string) => ['organizations', String(id), 'student', String(studentId)] as const,
    enrollments: (id: number | string, params: object) => ['organizations', String(id), 'enrollments', params] as const,
    lessons: (id: number | string, params: object) => ['organizations', String(id), 'lessons', params] as const,
    documents: (id: number | string, params: object) => ['organizations', String(id), 'documents', params] as const,
    invitationsAll: (id: number | string) => ['organizations', String(id), 'invitations'] as const,
  },
}
