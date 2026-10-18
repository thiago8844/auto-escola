import { z } from 'zod'

// Exame não tem duração nem protocolo: data, horário e as informações da inscrição
const slot = {
  date: z.string().min(1, 'Informe a data.'),
  start_time: z.string().min(1, 'Informe o horário.'),
}

// Autoescola do exame: 'space' = o próprio espaço (só em autoescola); senão, o ID de uma parceira
const drivingSchool = z.string().min(1, 'Escolha a autoescola do exame.')

export const examSchema = z.object({
  process_id: z.string().min(1, 'Escolha o processo.'),
  category: z.string().min(1, 'Escolha a categoria.'),
  enrollment_id: z.string(),
  partner_id: drivingSchool,
  ...slot,
  location: z.string().trim().max(150, 'Máximo de 150 caracteres.'),
  instructor_id: z.string(),
  vehicle_id: z.string(),
  notes: z.string().trim().max(2000, 'Máximo de 2000 caracteres.'),
})

// Remarcar é por imprevisto: só a nova data, com o motivo que fica no histórico
export const examRescheduleSchema = z.object({
  ...slot,
  reason: z.string().trim().min(3, 'Explique o motivo (mín. 3 caracteres).').max(255, 'Máximo de 255 caracteres.'),
})

export const examResultSchema = z.object({
  status: z.enum(['approved', 'failed', 'absent', 'incomplete', 'cancelled']),
  reason: z.string().trim().max(255, 'Máximo de 255 caracteres.'),
})

// Editar corrige qualquer informação, inclusive a data digitada errada
export const examEditSchema = z.object({
  ...slot,
  partner_id: drivingSchool,
  instructor_id: z.string(),
  vehicle_id: z.string(),
  location: z.string().trim().max(150, 'Máximo de 150 caracteres.'),
  notes: z.string().trim().max(2000, 'Máximo de 2000 caracteres.'),
})

export const feeSchema = z
  .object({
    kind: z.string().trim().min(2, 'Informe o tipo da taxa.').max(60, 'Máximo de 60 caracteres.'),
    voucher_number: z.string().trim().max(60, 'Máximo de 60 caracteres.'),
    amount: z.string(),
    issued_at: z.string(),
    due_date: z.string(),
    reference: z.string().trim().max(100, 'Máximo de 100 caracteres.'),
    obligor: z.enum(['student', 'partner', 'organization', 'other']),
    notes: z.string().trim().max(2000, 'Máximo de 2000 caracteres.'),
    exam_ids: z.array(z.string()),
  })
  .refine((d) => d.due_date === '' || d.issued_at === '' || d.due_date >= d.issued_at, { path: ['due_date'], message: 'O vencimento não pode ser anterior à emissão.' })

export const feeStatusSchema = z
  .object({
    status: z.enum(['unknown', 'pending', 'payment_reported', 'confirmed', 'waived', 'cancelled']),
    reason: z.string().trim().max(255, 'Máximo de 255 caracteres.'),
    paid_by: z.string(),
  })
  .superRefine((d, ctx) => {
    if (d.status === 'confirmed') {
      if (d.paid_by === '') ctx.addIssue({ code: 'custom', path: ['paid_by'], message: 'Informe quem pagou.' })
    }
    if ((d.status === 'waived' || d.status === 'cancelled') && d.reason.length < 3) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Informe o motivo.' })
    }
  })

export type ExamFormInput = z.infer<typeof examSchema>
export type ExamRescheduleInput = z.infer<typeof examRescheduleSchema>
export type ExamResultInput = z.infer<typeof examResultSchema>
export type ExamEditInput = z.infer<typeof examEditSchema>
export type FeeFormInput = z.infer<typeof feeSchema>
export type FeeStatusInput = z.infer<typeof feeStatusSchema>
