import { z } from 'zod'

const today = () => new Date().toISOString().slice(0, 10)

export const studentSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do aluno.').max(150, 'O nome deve ter no máximo 150 caracteres.'),
  cpf: z.string().trim().refine((value) => value === '' || value.replace(/\D/g, '').length === 11, 'Informe um CPF com 11 dígitos.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => value === '' || z.email().safeParse(value).success, 'Informe um e-mail válido.'),
  phone: z.string().trim().max(30, 'O telefone deve ter no máximo 30 caracteres.'),
  identity_number: z.string().trim().max(20, 'A identidade deve ter no máximo 20 caracteres.'),
  identity_issuer: z.string().trim().max(20, 'O órgão expedidor deve ter no máximo 20 caracteres.'),
  // Autoescola do aluno: 'space' = o próprio espaço (só em autoescola); senão, o ID de uma parceira
  partner_id: z.string().min(1, 'Escolha a autoescola do aluno.'),
  birth_date: z.string().refine((value) => value === '' || value < today(), 'A data de nascimento deve ser anterior a hoje.'),
})

export type StudentInput = z.infer<typeof studentSchema>
