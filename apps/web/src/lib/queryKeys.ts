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
    enrollment: (id: number | string, enrollmentId: number | string) => ['organizations', String(id), 'enrollment', String(enrollmentId)] as const,
    processes: (id: number | string, params: object) => ['organizations', String(id), 'processes', params] as const,
    process: (id: number | string, processId: number | string) => ['organizations', String(id), 'process', String(processId)] as const,
    vehicles: (id: number | string, params: object) => ['organizations', String(id), 'vehicles', params] as const,
    vehicle: (id: number | string, vehicleId: number | string) => ['organizations', String(id), 'vehicle', String(vehicleId)] as const,
    instructors: (id: number | string, params: object) => ['organizations', String(id), 'instructors', params] as const,
    instructor: (id: number | string, instructorId: number | string) => ['organizations', String(id), 'instructor', String(instructorId)] as const,
    agenda: (id: number | string, params: object) => ['organizations', String(id), 'agenda', params] as const,
    lesson: (id: number | string, lessonId: number | string) => ['organizations', String(id), 'lesson', String(lessonId)] as const,
    partners: (id: number | string, params: object) => ['organizations', String(id), 'partners', params] as const,
    partner: (id: number | string, partnerId: number | string) => ['organizations', String(id), 'partner', String(partnerId)] as const,
    lessons: (id: number | string, params: object) => ['organizations', String(id), 'lessons', params] as const,
    documents: (id: number | string, params: object) => ['organizations', String(id), 'documents', params] as const,
    invitationsAll: (id: number | string) => ['organizations', String(id), 'invitations'] as const,
  },
}
