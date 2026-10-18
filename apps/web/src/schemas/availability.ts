import { z } from 'zod'

export const blockSchema = z
  .object({
    resource_type: z.enum(['vehicle', 'instructor']),
    vehicle_id: z.string(),
    instructor_id: z.string(),
    scope: z.enum(['organization', 'personal']),
    kind: z.enum(['maintenance', 'absence', 'vacation', 'other']),
    start_date: z.string().min(1, 'Informe a data.'),
    start_time: z.string().min(1, 'Informe o horário.'),
    end_date: z.string().min(1, 'Informe a data.'),
    end_time: z.string().min(1, 'Informe o horário.'),
    reason: z.string().trim().min(3, 'Explique o motivo (mín. 3 caracteres).').max(255, 'Máximo de 255 caracteres.'),
  })
  .superRefine((d, ctx) => {
    if (d.resource_type === 'vehicle' && d.vehicle_id === '') ctx.addIssue({ code: 'custom', path: ['vehicle_id'], message: 'Escolha o veículo.' })
    if (d.resource_type === 'instructor' && d.instructor_id === '') ctx.addIssue({ code: 'custom', path: ['instructor_id'], message: 'Escolha o instrutor.' })
    if (d.start_date && d.end_date && `${d.end_date}T${d.end_time}` <= `${d.start_date}T${d.start_time}`) {
      ctx.addIssue({ code: 'custom', path: ['end_date'], message: 'O fim deve ser depois do início.' })
    }
  })

export type BlockInput = z.infer<typeof blockSchema>

const optionalInt = (max: number) => z.string().trim().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) <= max), 'Informe um número válido.')

export const maintenanceSchema = z
  .object({
    vehicle_id: z.string().min(1, 'Escolha o veículo.'),
    type: z.string().trim().min(2, 'Informe o tipo do serviço.').max(60, 'Máximo de 60 caracteres.'),
    scheduled_on: z.string().min(1, 'Informe a data.'),
    provider: z.string().trim().max(150, 'Máximo de 150 caracteres.'),
    odometer_km: optionalInt(9_999_999),
    estimated_cost: z.string(),
    notes: z.string().trim().max(2000, 'Máximo de 2000 caracteres.'),
    block_agenda: z.boolean(),
    block_start_time: z.string(),
    block_end_date: z.string(),
    block_end_time: z.string(),
  })
  .superRefine((d, ctx) => {
    if (!d.block_agenda) return
    if (d.block_end_date === '') ctx.addIssue({ code: 'custom', path: ['block_end_date'], message: 'Informe até quando o veículo fica parado.' })
    else if (d.block_end_date < d.scheduled_on) ctx.addIssue({ code: 'custom', path: ['block_end_date'], message: 'Não pode ser antes do início.' })
  })

export type MaintenanceInput = z.infer<typeof maintenanceSchema>

export const completeMaintenanceSchema = z.object({
  performed_on: z.string().min(1, 'Informe a data do serviço.'),
  actual_cost: z.string(),
  odometer_km: optionalInt(9_999_999),
  next_due_date: z.string(),
  next_due_km: optionalInt(9_999_999),
  notes: z.string().trim().max(2000, 'Máximo de 2000 caracteres.'),
})

export type CompleteMaintenanceInput = z.infer<typeof completeMaintenanceSchema>
