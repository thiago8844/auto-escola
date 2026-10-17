export const paths = {
  home: '/',
  login: '/login',
  register: '/cadastro',
  verifyEmailNotice: '/verifique-email',
  // O e-mail enviado pela API aponta para este caminho (com expires e signature na query)
  verifyEmail: '/auth/email/verify/:id/:hash',
  // O e-mail de convite aponta para este caminho (com ?token=)
  acceptInvitation: '/convites/aceitar',
  organizations: '/espacos',
  organizationNew: '/espacos/novo',
  organization: '/espacos/:organizationId',
} as const

// Segmentos filhos de /espacos/:organizationId
export const organizationSections = {
  members: 'membros',
  invitations: 'convites',
  settings: 'configuracoes',
} as const

// O espaço ativo está sempre na URL
export function organizationPaths(organizationId: number | string) {
  const base = `${paths.organizations}/${organizationId}`
  return {
    home: base,
    members: `${base}/${organizationSections.members}`,
    invitations: `${base}/${organizationSections.invitations}`,
    settings: `${base}/${organizationSections.settings}`,
  }
}
