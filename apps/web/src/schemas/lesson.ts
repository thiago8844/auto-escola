import { z } from 'zod'

const MAX_MINUTES = 240

const minutesField = (required: boolean) =>
  z
    .string()
    .trim()
    .refine((v) => (required ? v !== '' : true), 'Informe a duração em minutos.')
    .refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= MAX_MINUTES), `Informe de 1 a ${MAX_MINUTES} minutos.`)

// Data e hora são digitadas no fuso do espaço; a conversão para UTC é feita no envio
const windowFields = {
  date: z.string().min(1, 'Informe a data.'),
  start_time: z.string().min(1, 'Informe o horário.'),
  duration: minutesField(true),
}

export const scheduleSchema = z.object({
  enrollment_id: z.string().min(1, 'Escolha a matrícula.'),
  instructor_id: z.string().min(1, 'Escolha o instrutor.'),
  vehicle_id: z.string(),
  ...windowFields,
  notes: z.string().trim().max(2000, 'Máximo de 2000 caracteres.'),
})

export const rescheduleSchema = z.object(windowFields)

export const lessonStatusSchema = z.object({
  status: z.enum(['completed', 'missed', 'cancelled']),
  reason: z.string().trim().max(255, 'Máximo de 255 caracteres.'),
  actual_minutes: minutesField(false),
  evolution: z.string().trim().max(5000, 'Máximo de 5000 caracteres.'),
  notes: z.string().trim().max(2000, 'Máximo de 2000 caracteres.'),
})

export const lessonNotesSchema = z.object({
  notes: z.string().trim().max(2000, 'Máximo de 2000 caracteres.'),
  evolution: z.string().trim().max(5000, 'Máximo de 5000 caracteres.'),
  actual_minutes: minutesField(false),
})

export const registrySchema = z
  .object({
    registry_status: z.enum(['not_informed', 'pending', 'confirmed', 'rejected']),
    registry_reference: z.string().trim().max(100, 'Máximo de 100 caracteres.'),
    // ID do documento que comprova o lançamento ('' = nenhum)
    registry_document_id: z.string(),
  })
  .refine((data) => data.registry_status !== 'confirmed' || data.registry_reference !== '' || data.registry_document_id !== '', {
    path: ['registry_reference'],
    message: 'Para confirmar, informe o protocolo ou vincule um documento.',
  })

export type ScheduleInput = z.infer<typeof scheduleSchema>
export type RescheduleInput = z.infer<typeof rescheduleSchema>
export type LessonStatusInput = z.infer<typeof lessonStatusSchema>
export type LessonNotesInput = z.infer<typeof lessonNotesSchema>
export type RegistryInput = z.infer<typeof registrySchema>
