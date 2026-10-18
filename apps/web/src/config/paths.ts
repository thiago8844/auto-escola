export const paths = {
  home: '/',
  login: '/login',
  register: '/cadastro',
  verifyEmailNotice: '/verifique-email',
  // O e-mail enviado pela API aponta para este caminho (com expires e signature na query)
  verifyEmail: '/auth/email/verify/:id/:hash',
  // O e-mail de convite aponta para este caminho (com ?token=)
  acceptInvitation: '/convites/aceitar',
  settings: '/configuracoes',
  organizations: '/espacos',
  organizationNew: '/espacos/novo',
  organization: '/espacos/:organizationId',
} as const

// Segmentos filhos de /espacos/:organizationId
export const organizationSections = {
  members: 'membros',
  invitations: 'convites',
  settings: 'configuracoes',
  students: 'alunos',
  enrollments: 'matriculas',
  processes: 'processos',
  vehicles: 'veiculos',
  instructors: 'instrutores',
  schedule: 'agenda',
  partners: 'parceiros',
} as const

// O espaço ativo está sempre na URL
export function organizationPaths(organizationId: number | string) {
  const base = `${paths.organizations}/${organizationId}`
  return {
    home: base,
    members: `${base}/${organizationSections.members}`,
    invitations: `${base}/${organizationSections.invitations}`,
    settings: `${base}/${organizationSections.settings}`,
    students: `${base}/${organizationSections.students}`,
    studentNew: `${base}/${organizationSections.students}/novo`,
    student: (studentId: number | string) => `${base}/${organizationSections.students}/${studentId}`,
    studentEdit: (studentId: number | string) => `${base}/${organizationSections.students}/${studentId}/editar`,
    enrollments: `${base}/${organizationSections.enrollments}`,
    enrollment: (enrollmentId: number | string) => `${base}/${organizationSections.enrollments}/${enrollmentId}`,
    enrollmentNew: (studentId: number | string) => `${base}/${organizationSections.students}/${studentId}/matriculas/nova`,
    processes: `${base}/${organizationSections.processes}`,
    process: (processId: number | string) => `${base}/${organizationSections.processes}/${processId}`,
    vehicles: `${base}/${organizationSections.vehicles}`,
    vehicleNew: `${base}/${organizationSections.vehicles}/novo`,
    vehicle: (vehicleId: number | string) => `${base}/${organizationSections.vehicles}/${vehicleId}`,
    instructors: `${base}/${organizationSections.instructors}`,
    instructorNew: `${base}/${organizationSections.instructors}/novo`,
    instructor: (instructorId: number | string) => `${base}/${organizationSections.instructors}/${instructorId}`,
    schedule: `${base}/${organizationSections.schedule}`,
    scheduleNew: (query = '') => `${base}/${organizationSections.schedule}/nova${query}`,
    lesson: (lessonId: number | string) => `${base}/${organizationSections.schedule}/${lessonId}`,
    partners: `${base}/${organizationSections.partners}`,
    partnerNew: `${base}/${organizationSections.partners}/novo`,
    partner: (partnerId: number | string) => `${base}/${organizationSections.partners}/${partnerId}`,
    processNew: (studentId: number | string) => `${base}/${organizationSections.students}/${studentId}/processos/novo`,
  }
}
