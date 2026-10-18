import type { DocumentUploadInput } from '../schemas/document'
import type { DocumentStatus, StudentDocument } from '../types/document'
import type { Paginated } from '../types/organization'
import { http } from './client'

const base = (organizationId: number | string) => `/organizations/${organizationId}/documents`
const handledByScreen = { skipGlobalError: true } as const

export async function listStudentDocuments(organizationId: number | string, studentId: number | string): Promise<Paginated<StudentDocument>> {
  const { data } = await http.get<Paginated<StudentDocument>>(base(organizationId), {
    params: { student_id: studentId, per_page: 100 },
    ...handledByScreen,
  })
  return data
}

export async function uploadDocument(organizationId: number | string, studentId: number, input: DocumentUploadInput): Promise<StudentDocument> {
  const form = new FormData()
  form.append('file', input.file[0])
  form.append('type', input.type)
  form.append('student_id', String(studentId))
  for (const field of ['issuer', 'issued_at', 'expires_at', 'notes'] as const) {
    if (input[field]) form.append(field, input[field])
  }
  const { data } = await http.post<{ data: StudentDocument }>(base(organizationId), form, handledByScreen)
  return data.data
}

export async function updateDocumentStatus(organizationId: number | string, documentId: number, status: DocumentStatus): Promise<StudentDocument> {
  const { data } = await http.patch<{ data: StudentDocument }>(`${base(organizationId)}/${documentId}`, { status })
  return data.data
}

// O arquivo só sai por esta chamada autenticada (cookie + permissão): não existe URL pública
export async function fetchDocumentFile(organizationId: number | string, documentId: number): Promise<Blob> {
  const { data } = await http.get<Blob>(`${base(organizationId)}/${documentId}/download`, { responseType: 'blob', skipGlobalError: true })
  return data
}
