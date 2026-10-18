import { z } from 'zod'
import { VEHICLE_CATEGORIES } from '../config/domain'

const maxYear = () => new Date().getFullYear() + 1

export const vehicleSchema = z.object({
  plate: z
    .string()
    .transform((value) => value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())
    .refine((value) => value.length === 7, 'A placa deve ter 7 caracteres (ex.: ABC1D23).'),
  brand: z.string().trim().max(60, 'Máximo de 60 caracteres.'),
  model: z.string().trim().min(1, 'Informe o modelo.').max(80, 'Máximo de 80 caracteres.'),
  year: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d{4}$/.test(v) && Number(v) >= 1950 && Number(v) <= maxYear()), `Informe um ano entre 1950 e ${maxYear()}.`),
  category: z.enum(VEHICLE_CATEGORIES, { error: 'Escolha a categoria.' }),
  adapted: z.boolean(),
  adaptations: z.string().trim().max(2000, 'Máximo de 2000 caracteres.'),
  crlv_expires_at: z.string(),
  status: z.enum(['active', 'inactive']),
  notes: z.string().trim().max(2000, 'Máximo de 2000 caracteres.'),
})

export type VehicleInput = z.infer<typeof vehicleSchema>
