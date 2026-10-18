import { z } from 'zod'
import { LICENSE_CATEGORIES, UFS } from '../config/domain'

const category = z.enum(LICENSE_CATEGORIES as [string, ...string[]])
const today = () => new Date().toISOString().slice(0, 10)

export const processSchema = z
  .object({
    type: z.enum(['first_license', 'category_addition', 'category_change', 'refresher'], { error: 'Escolha o tipo.' }),
    uf: z.enum(UFS, { error: 'Escolha a UF.' }),
    municipality: z.string().trim().max(100, 'Máximo de 100 caracteres.'),
    renach: z.string().trim().max(30, 'Máximo de 30 caracteres.'),
    protocol: z.string().trim().max(50, 'Máximo de 50 caracteres.'),
    opened_at: z.string().refine((v) => v === '' || v <= today(), 'A data de abertura não pode ser futura.'),
    current_categories: z.array(category),
    target_categories: z.array(category).min(1, 'Escolha ao menos uma categoria pretendida.'),
    notes: z.string().trim().max(2000, 'Máximo de 2000 caracteres.'),
  })
  .superRefine((data, ctx) => {
    // Regra da API: categorias atuais só fora da primeira habilitação
    if (data.type === 'first_license' && data.current_categories.length > 0) {
      ctx.addIssue({ code: 'custom', path: ['current_categories'], message: 'Primeira habilitação não tem categoria atual.' })
    }
    if (data.type !== 'first_license' && data.current_categories.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['current_categories'], message: 'Escolha ao menos uma categoria atual.' })
    }
  })

export type ProcessInput = z.infer<typeof processSchema>

export const checklistItemSchema = z
  .object({
    status: z.enum(['unknown', 'pending', 'in_progress', 'done', 'verified', 'not_applicable', 'blocked']),
    source: z.string(),
    reference: z.string().trim().max(100, 'Máximo de 100 caracteres.'),
    occurred_on: z.string(),
    // Evidência privada ('' = nenhuma). Anexar não confere o item: a conferência é a situação "Conferido".
    document_id: z.string(),
    notes: z.string().trim().max(2000, 'Máximo de 2000 caracteres.'),
  })
  .superRefine((data, ctx) => {
    if ((data.status === 'not_applicable' || data.status === 'blocked') && data.notes === '') {
      ctx.addIssue({ code: 'custom', path: ['notes'], message: 'Informe o motivo.' })
    }
    if (data.status === 'verified' && (data.source === '' || data.source === 'student_declared')) {
      ctx.addIssue({ code: 'custom', path: ['source'], message: 'Para conferir, a origem não pode ser só a declaração do aluno.' })
    }
  })

export type ChecklistItemInput = z.infer<typeof checklistItemSchema>
