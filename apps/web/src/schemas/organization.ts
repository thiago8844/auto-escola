import { z } from 'zod'

const digitsLength = (value: string) => value.replace(/\D/g, '').length

export const organizationSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do espaço.').max(150, 'O nome deve ter no máximo 150 caracteres.'),
  type: z.enum(['cfc', 'independent'], { error: 'Escolha o tipo do espaço.' }),
  document: z
    .string()
    .trim()
    .refine((value) => value === '' || [11, 14].includes(digitsLength(value)), 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((value) => value === '' || z.email().safeParse(value).success, 'Informe um e-mail válido.'),
  phone: z.string().trim().max(30, 'O telefone deve ter no máximo 30 caracteres.'),
  timezone: z.string().min(1, 'Escolha o fuso horário.'),
})

// O tipo do espaço não muda depois de criado
export const organizationUpdateSchema = organizationSchema.omit({ type: true })

export type OrganizationInput = z.infer<typeof organizationSchema>
export type OrganizationUpdateInput = z.infer<typeof organizationUpdateSchema>
