import { z } from 'zod'

export const partnerSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do parceiro.').max(150, 'O nome deve ter no máximo 150 caracteres.'),
  document: z.string().trim().refine((v) => v === '' || [11, 14].includes(v.replace(/\D/g, '').length), 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos).'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === '' || z.email().safeParse(v).success, 'Informe um e-mail válido.'),
  phone: z.string().trim().max(30, 'O telefone deve ter no máximo 30 caracteres.'),
})

export type PartnerInput = z.infer<typeof partnerSchema>
