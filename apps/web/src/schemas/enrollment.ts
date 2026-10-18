import { z } from 'zod'
import { LICENSE_CATEGORIES } from '../config/domain'

export const enrollmentSchema = z.object({
  category: z.enum(LICENSE_CATEGORIES as [string, ...string[]], { error: 'Escolha a categoria.' }),
  status: z.enum(['prospect', 'contracted', 'in_service', 'closed', 'terminated']),
  // Serviço contratado em minutos (a API não presume hora nem hora-aula)
  contracted_minutes: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 100000), 'Informe os minutos como número inteiro (1 a 100000).'),
  // Reais como texto ("2500.5"); vira centavos no envio
  price: z.string(),
  qualification_process_id: z.string(),
  notes: z.string().trim().max(2000, 'As observações devem ter no máximo 2000 caracteres.'),
})

export type EnrollmentInput = z.infer<typeof enrollmentSchema>
