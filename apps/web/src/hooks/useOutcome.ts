import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  closeProcess,
  confirmRenunciation,
  getClosureCheck,
  listTimeline,
  registerIssuance,
  renounceCategory,
  reopenProcess,
  revertRenunciation,
  type IssuanceInput,
  type TimelineScope,
} from '../api/outcome'
import { queryKeys } from '../lib/queryKeys'
import { notify } from '../stores/toastStore'

export function useClosureCheck(organizationId: number, processId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.organizations.closureCheck(organizationId, processId),
    queryFn: () => getClosureCheck(organizationId, processId),
    enabled,
  })
}

export function useTimeline(organizationId: number, scope: TimelineScope, page: number, category?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.organizations.timeline(organizationId, { ...scope, page, category }),
    queryFn: () => listTimeline(organizationId, scope, page, category),
    placeholderData: keepPreviousData,
    enabled,
  })
}

function useOutcomeMutation<T>(organizationId: number, mutationFn: (input: T) => Promise<unknown>, message: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      notify.success(message)
      return queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) })
    },
  })
}

export const useRegisterIssuance = (o: number, p: string) => useOutcomeMutation(o, (input: IssuanceInput) => registerIssuance(o, p, input), 'Emissão atualizada.')

export const useCloseProcess = (o: number, p: string) =>
  useOutcomeMutation(o, (input: Parameters<typeof closeProcess>[2]) => closeProcess(o, p, input), 'Processo encerrado.')

export const useReopenProcess = (o: number, p: string) => useOutcomeMutation(o, (reason: string) => reopenProcess(o, p, reason), 'Processo reaberto.')

export const useRenounce = (o: number, p: string) =>
  useOutcomeMutation(o, ({ category, reason }: { category: string; reason: string }) => renounceCategory(o, p, category, reason), 'Renúncia registrada.')

export const useConfirmRenunciation = (o: number, p: string) =>
  useOutcomeMutation(o, ({ category, reference }: { category: string; reference: string }) => confirmRenunciation(o, p, category, reference), 'Renúncia confirmada.')

export const useRevertRenunciation = (o: number, p: string) =>
  useOutcomeMutation(o, ({ category, reason }: { category: string; reason: string }) => revertRenunciation(o, p, category, reason), 'Renúncia desfeita.')
