import { z } from 'zod'

export const issuanceSchema = z
  .object({
    status: z.enum(['pending', 'issued', 'delivered']),
    kind: z.string(),
    reference: z.string().trim().max(100, 'Máximo de 100 caracteres.'),
    issued_at: z.string(),
    delivered_at: z.string(),
    definitive_follow_up: z.boolean(),
    definitive_due_at: z.string(),
    reason: z.string().trim().max(255, 'Máximo de 255 caracteres.'),
  })
  .superRefine((d, ctx) => {
    if (d.status !== 'pending') {
      if (d.kind === '') ctx.addIssue({ code: 'custom', path: ['kind'], message: 'Informe se é PPD ou CNH.' })
      if (d.issued_at === '') ctx.addIssue({ code: 'custom', path: ['issued_at'], message: 'Informe a data de emissão.' })
      if (d.reference === '') ctx.addIssue({ code: 'custom', path: ['reference'], message: 'Informe a referência (número/protocolo) da emissão.' })
    }
    if (d.status === 'delivered' && d.delivered_at === '') ctx.addIssue({ code: 'custom', path: ['delivered_at'], message: 'Informe a data da entrega.' })
    if (d.delivered_at !== '' && d.issued_at !== '' && d.delivered_at < d.issued_at) ctx.addIssue({ code: 'custom', path: ['delivered_at'], message: 'A entrega não pode ser anterior à emissão.' })
  })

export const closeSchema = z.object({
  kind: z.enum(['completed', 'abandoned', 'other']),
  reason: z.string().trim().max(255, 'Máximo de 255 caracteres.'),
  cancel_future: z.boolean(),
  acknowledge_pending: z.boolean(),
})

export type IssuanceFormInput = z.infer<typeof issuanceSchema>
export type CloseFormInput = z.infer<typeof closeSchema>
