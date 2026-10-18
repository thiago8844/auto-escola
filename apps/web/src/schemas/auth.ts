import { z } from 'zod'
import { PASSWORD_MIN } from '../config'
import { emailField as email } from './shared'

const newPassword = z.string().min(PASSWORD_MIN, `A senha deve ter ao menos ${PASSWORD_MIN} caracteres.`)

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha.'),
})

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Informe seu nome.').max(150, 'O nome deve ter no máximo 150 caracteres.'),
    email,
    password: newPassword,
    password_confirmation: z.string().min(1, 'Confirme a senha.'),
  })
  .refine((data) => data.password === data.password_confirmation, {
    path: ['password_confirmation'],
    message: 'As senhas não conferem.',
  })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    password_confirmation: z.string().min(1, 'Confirme a senha.'),
  })
  .refine((data) => data.password === data.password_confirmation, { path: ['password_confirmation'], message: 'As senhas não conferem.' })

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Informe a senha atual.'),
    password: newPassword,
    password_confirmation: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.password === data.password_confirmation, { path: ['password_confirmation'], message: 'As senhas não conferem.' })
  .refine((data) => data.password !== data.current_password, { path: ['password'], message: 'A nova senha deve ser diferente da atual.' })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
