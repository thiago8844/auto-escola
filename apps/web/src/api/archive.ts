import { http } from './client'

export type Archivable = 'students' | 'partners' | 'vehicles'

const handledByScreen = { skipGlobalError: true } as const

// Arquivar não apaga: o histórico continua ligado ao cadastro. A API explica o que impede (aulas agendadas etc.).
export async function archiveRecord(organizationId: number | string, resource: Archivable, id: number): Promise<void> {
  await http.delete(`/organizations/${organizationId}/${resource}/${id}`, handledByScreen)
}

export async function restoreRecord(organizationId: number | string, resource: Archivable, id: number): Promise<void> {
  await http.post(`/organizations/${organizationId}/${resource}/${id}/restore`, undefined, handledByScreen)
}
