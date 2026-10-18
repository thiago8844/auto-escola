import { z } from 'zod'
import { LICENSE_CATEGORIES } from '../config/domain'

export const instructorSchema = z.object({
  full_name: z.string().trim().min(1, 'Informe o nome do instrutor.').max(150, 'O nome deve ter no máximo 150 caracteres.'),
  credential_number: z.string().trim().max(50, 'Máximo de 50 caracteres.'),
  categories: z.array(z.enum(LICENSE_CATEGORIES as [string, ...string[]])),
})

export type InstructorInput = z.infer<typeof instructorSchema>
