import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createProcess, getProcess, listProcesses, updateChecklistItem, updateProcessStatus, type ProcessListParams } from '../api/processes'
import { queryKeys } from '../lib/queryKeys'
import type { ChecklistItemInput, ProcessInput } from '../schemas/process'
import { notify } from '../stores/toastStore'
import type { ProcessStatus } from '../types/process'

export function useProcesses(organizationId: number, params: ProcessListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.organizations.processes(organizationId, params),
    queryFn: () => listProcesses(organizationId, params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useProcess(organizationId: number, processId: string) {
  return useQuery({
    queryKey: queryKeys.organizations.process(organizationId, processId),
    queryFn: () => getProcess(organizationId, processId),
  })
}

export function useCreateProcess(organizationId: number, studentId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ProcessInput) => createProcess(organizationId, studentId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }),
  })
}

export function useUpdateProcessStatus(organizationId: number, processId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (status: ProcessStatus) => updateProcessStatus(organizationId, processId, status),
    meta: { toastOnError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }),
  })
}

// Mudar um item pode liberar ou bloquear a prática: atualiza processo, matrículas e aulas do espaço
export function useUpdateChecklistItem(organizationId: number, processId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: number; input: ChecklistItemInput }) => updateChecklistItem(organizationId, processId, itemId, input),
    onSuccess: () => {
      notify.success('Item atualizado.')
      return queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) })
    },
  })
}
