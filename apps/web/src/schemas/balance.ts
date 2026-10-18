import { z } from 'zod'

const positiveInt = (max: number, message: string) =>
  z
    .string()
    .trim()
    .refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= max, message)

export const packageSchema = z
  .object({
    kind: z.enum(['contract', 'addition']),
    description: z.string().trim().min(3, 'Descreva a contratação (mín. 3 caracteres).').max(150, 'Máximo de 150 caracteres.'),
    minutes: positiveInt(100000, 'Informe a quantidade de minutos.'),
    // Sem duração de referência o sistema não converte minutos em aulas
    reference_minutes: z.string().trim().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 240), 'Informe de 1 a 240 minutos.'),
    price: z.string(),
    category: z.string(),
    consume_basis: z.enum(['actual', 'scheduled']),
    absence_charge: z.enum(['none', 'full']),
    late_cancel_charge: z.enum(['none', 'full']),
    cancel_notice_hours: z.string().trim(),
  })
  .refine((d) => d.late_cancel_charge === 'none' || (/^\d+$/.test(d.cancel_notice_hours) && Number(d.cancel_notice_hours) >= 1 && Number(d.cancel_notice_hours) <= 720), {
    path: ['cancel_notice_hours'],
    message: 'Informe o aviso prévio em horas (1 a 720).',
  })

export const adjustSchema = z.object({
  direction: z.enum(['add', 'remove']),
  minutes: positiveInt(100000, 'Informe a quantidade de minutos.'),
  category: z.string(),
  reason: z.string().trim().min(3, 'Explique o motivo (mín. 3 caracteres).').max(255, 'Máximo de 255 caracteres.'),
})

export const reasonSchema = z.object({
  reason: z.string().trim().min(3, 'Explique o motivo (mín. 3 caracteres).').max(255, 'Máximo de 255 caracteres.'),
})

export type PackageFormInput = z.infer<typeof packageSchema>
export type AdjustFormInput = z.infer<typeof adjustSchema>
export type ReasonFormInput = z.infer<typeof reasonSchema>
