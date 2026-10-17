import { z } from 'zod'
import { emailField } from './shared'

export const invitationSchema = z.object({
  email: emailField,
  role: z.enum(['owner', 'admin', 'staff', 'instructor'], { error: 'Escolha o papel.' }),
})

export type InvitationInput = z.infer<typeof invitationSchema>
