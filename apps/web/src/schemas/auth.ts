import { z } from 'zod'

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Informe o e-mail.')
  .pipe(z.email('Informe um e-mail válido.'))

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha.'),
})

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe seu nome.').max(150, 'O nome deve ter no máximo 150 caracteres.'),
    email,
    password: z.string().min(8, 'A senha deve ter ao menos 8 caracteres.'),
    password_confirmation: z.string().min(1, 'Confirme a senha.'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    path: ['password_confirmation'],
    message: 'As senhas não conferem.',
  })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
