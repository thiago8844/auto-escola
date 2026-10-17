export const paths = {
  home: '/',
  login: '/login',
  register: '/cadastro',
  verifyEmailNotice: '/verifique-email',
  // O e-mail enviado pela API aponta para este caminho (com expires e signature na query)
  verifyEmail: '/auth/email/verify/:id/:hash',
} as const
