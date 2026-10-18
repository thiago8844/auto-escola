import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDocumentFile, listDocumentVersions, updateDocumentStatus, uploadDocument, type DocumentOwner } from '../api/documents'
import { queryKeys } from '../lib/queryKeys'
import type { DocumentUploadInput } from '../schemas/document'
import { notify } from '../stores/toastStore'
import type { DocumentStatus, StudentDocument } from '../types/document'

export function useDocumentVersions(organizationId: number, documentId: number, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.organizations.detail(organizationId), 'document-versions', documentId],
    queryFn: () => listDocumentVersions(organizationId, documentId),
    enabled,
  })
}

export function useUploadDocument(organizationId: number, owner: DocumentOwner) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DocumentUploadInput) => uploadDocument(organizationId, owner, input),
    onSuccess: () => {
      notify.success(owner.replaces_document_id ? 'Nova versão anexada; a anterior ficou no histórico.' : 'Documento anexado.')
      return queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) })
    },
  })
}

export function useUpdateDocumentStatus(organizationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ documentId, status }: { documentId: number; status: DocumentStatus }) => updateDocumentStatus(organizationId, documentId, status),
    meta: { toastOnError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }),
  })
}

type FileAction = { document: StudentDocument; mode: 'view' | 'download'; tab: Window | null }

// Visualizar abre o arquivo numa aba; baixar salva com o nome original. Os dois passam pela API autenticada.
export function useDocumentFile(organizationId: number) {
  return useMutation({
    mutationFn: ({ document }: FileAction) => fetchDocumentFile(organizationId, document.id),
    meta: { toastOnError: true },
    onSuccess: (blob, { document, mode, tab }) => {
      const url = URL.createObjectURL(blob)
      if (mode === 'view' && tab) {
        tab.location.href = url
      } else {
        const link = window.document.createElement('a')
        link.href = url
        link.download = document.original_name
        link.click()
      }
      // Libera a memória depois que o navegador carregou o arquivo
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    },
    onError: (_error, { tab }) => tab?.close(),
  })
}
