import type { DocumentUploadInput } from '../schemas/document'
import type { DocumentStatus, StudentDocument } from '../types/document'
import type { Paginated } from '../types/organization'
import { http } from './client'
import { fetchAllPages } from './paginate'

const base = (organizationId: number | string) => `/organizations/${organizationId}/documents`
const handledByScreen = { skipGlobalError: true } as const

export async function listStudentDocuments(organizationId: number | string, studentId: number | string): Promise<Paginated<StudentDocument>> {
  return fetchAllPages(async (page) => {
    const { data } = await http.get<Paginated<StudentDocument>>(base(organizationId), {
      params: { student_id: studentId, per_page: 100, page },
      ...handledByScreen,
    })
    return data
  })
}

// Anexos privados de uma tentativa de exame
export async function listExamDocuments(organizationId: number | string, examId: number | string): Promise<Paginated<StudentDocument>> {
  return fetchAllPages(async (page) => {
    const { data } = await http.get<Paginated<StudentDocument>>(base(organizationId), {
      params: { practical_exam_id: examId, per_page: 100, page },
      ...handledByScreen,
    })
    return data
  })
}

// A quem o documento pertence (ao menos um) e, se for nova versão, qual documento ele substitui
export type DocumentOwner = { student_id?: number; vehicle_id?: number; qualification_process_id?: number; replaces_document_id?: number }

export async function uploadDocument(organizationId: number | string, owner: DocumentOwner, input: DocumentUploadInput): Promise<StudentDocument> {
  const form = new FormData()
  form.append('file', input.file[0])
  form.append('type', input.type)
  for (const [field, value] of Object.entries(owner)) {
    if (value !== undefined) form.append(field, String(value))
  }
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

// Todas as versões de um documento, da mais nova para a mais antiga
export async function listDocumentVersions(organizationId: number | string, documentId: number): Promise<StudentDocument[]> {
  const { data } = await http.get<{ data: StudentDocument[] }>(`${base(organizationId)}/${documentId}/versions`, handledByScreen)
  return data.data
}
