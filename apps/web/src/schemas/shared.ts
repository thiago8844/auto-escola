import { z } from 'zod'

export const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Informe o e-mail.')
  .pipe(z.email('Informe um e-mail válido.'))
