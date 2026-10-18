import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adjustBalance, createPackage, getBalance, listCreditEntries, reverseEntry, type PackageInput } from '../api/balance'
import { queryKeys } from '../lib/queryKeys'
import { notify } from '../stores/toastStore'

export function useBalance(organizationId: number, enrollmentId: string | number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.organizations.balance(organizationId, enrollmentId),
    queryFn: () => getBalance(organizationId, enrollmentId),
    enabled,
  })
}

export function useCreditEntries(organizationId: number, enrollmentId: string | number, page: number) {
  return useQuery({
    queryKey: queryKeys.organizations.creditEntries(organizationId, enrollmentId, page),
    queryFn: () => listCreditEntries(organizationId, enrollmentId, page),
    placeholderData: keepPreviousData,
  })
}

// Contratar, ajustar ou estornar muda saldo, matrícula, agenda e linha do tempo: atualiza o espaço todo
function useBalanceMutation<T>(organizationId: number, mutationFn: (input: T) => Promise<unknown>, message: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      notify.success(message)
      return queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) })
    },
  })
}

export function useCreatePackage(organizationId: number, enrollmentId: number) {
  return useBalanceMutation(organizationId, (input: PackageInput) => createPackage(organizationId, enrollmentId, input), 'Contratação registrada.')
}

export function useAdjustBalance(organizationId: number, enrollmentId: number) {
  return useBalanceMutation(
    organizationId,
    (input: { minutes: number; category: string | null; reason: string }) => adjustBalance(organizationId, enrollmentId, input),
    'Ajuste registrado no extrato.',
  )
}

export function useReverseEntry(organizationId: number, enrollmentId: number) {
  return useBalanceMutation(
    organizationId,
    ({ entryId, reason }: { entryId: number; reason: string }) => reverseEntry(organizationId, enrollmentId, entryId, reason),
    'Estorno registrado; o movimento original foi preservado.',
  )
}
