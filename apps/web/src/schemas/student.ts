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
  birth_date: z.string().refine((value) => value === '' || value < today(), 'A data de nascimento deve ser anterior a hoje.'),
})

export type StudentInput = z.infer<typeof studentSchema>
