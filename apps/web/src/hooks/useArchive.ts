import { useMutation, useQueryClient } from '@tanstack/react-query'
import { archiveRecord, restoreRecord, type Archivable } from '../api/archive'
import { queryKeys } from '../lib/queryKeys'
import { notify } from '../stores/toastStore'

const NOUNS: Record<Archivable, string> = { students: 'Aluno', partners: 'Parceiro', vehicles: 'Veículo' }

export function useArchive(organizationId: number, resource: Archivable) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) })

  const archive = useMutation({
    mutationFn: (id: number) => archiveRecord(organizationId, resource, id),
    meta: { toastOnError: true },
    onSuccess: () => {
      notify.success(`${NOUNS[resource]} arquivado. O histórico foi mantido.`)
      return invalidate()
    },
  })

  const restore = useMutation({
    mutationFn: (id: number) => restoreRecord(organizationId, resource, id),
    meta: { toastOnError: true },
    onSuccess: () => {
      notify.success(`${NOUNS[resource]} restaurado.`)
      return invalidate()
    },
  })

  return { archive, restore }
}
