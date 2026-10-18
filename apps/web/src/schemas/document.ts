import { z } from 'zod'
import { DOCUMENT_TYPE_LABELS } from '../config/domain'
import type { DocumentType } from '../types/document'

export const DOCUMENT_MAX_MB = 10
export const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp'
const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']

const documentTypes = Object.keys(DOCUMENT_TYPE_LABELS) as [DocumentType, ...DocumentType[]]

export const documentUploadSchema = z
  .object({
    file: z
      .custom<FileList>((value) => typeof FileList !== 'undefined' && value instanceof FileList && value.length > 0, 'Escolha um arquivo.')
      .refine((files) => files[0] && ALLOWED_TYPES.includes(files[0].type), 'Tipo não permitido. Use PDF, JPG, PNG ou WebP.')
      .refine((files) => files[0] && files[0].size <= DOCUMENT_MAX_MB * 1024 * 1024, `O arquivo deve ter no máximo ${DOCUMENT_MAX_MB} MB.`),
    type: z.enum(documentTypes, { error: 'Escolha o tipo do documento.' }),
    issuer: z.string().trim().max(150, 'Máximo de 150 caracteres.'),
    issued_at: z.string(),
    expires_at: z.string(),
    notes: z.string().trim().max(2000, 'Máximo de 2000 caracteres.'),
  })
  .refine((data) => data.expires_at === '' || data.issued_at === '' || data.expires_at >= data.issued_at, {
    path: ['expires_at'],
    message: 'A validade não pode ser anterior à emissão.',
  })

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>
