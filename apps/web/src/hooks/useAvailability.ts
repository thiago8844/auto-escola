import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelMaintenance,
  completeMaintenance,
  createBlock,
  createMaintenance,
  getInstructorAvailability,
  getVehicleOverview,
  listBlocks,
  listMaintenances,
  previewImpact,
  reassignLesson,
  releaseBlock,
  saveWeeklyHours,
  type BlockListParams,
  type BlockPayload,
} from '../api/availability'
import { queryKeys } from '../lib/queryKeys'
import type { CompleteMaintenanceInput, MaintenanceInput } from '../schemas/availability'
import { notify } from '../stores/toastStore'
import type { WeeklyHours } from '../types/availability'

export function useBlocks(organizationId: number, params: BlockListParams) {
  return useQuery({
    queryKey: queryKeys.organizations.blocks(organizationId, params),
    queryFn: () => listBlocks(organizationId, params),
    placeholderData: keepPreviousData,
  })
}

export function useMaintenances(organizationId: number, params: { page: number; status?: string; vehicleId?: string }, enabled = true) {
  return useQuery({
    queryKey: queryKeys.organizations.maintenances(organizationId, params),
    queryFn: () => listMaintenances(organizationId, params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useVehicleOverview(organizationId: number, vehicleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.vehicleOverview(organizationId, vehicleId ?? ''),
    queryFn: () => getVehicleOverview(organizationId, vehicleId!),
    enabled: !!vehicleId,
  })
}

export function useInstructorAvailability(organizationId: number, instructorId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.instructorAvailability(organizationId, instructorId ?? ''),
    queryFn: () => getInstructorAvailability(organizationId, instructorId!),
    enabled: !!instructorId,
  })
}

// Prévia dos compromissos que um bloqueio atingiria; só roda com o período completo
export function useImpactPreview(organizationId: number, p: { vehicleId?: string; instructorId?: string; startsAt: string | null; endsAt: string | null }) {
  const ready = !!p.startsAt && !!p.endsAt && !!(p.vehicleId || p.instructorId) && p.endsAt > p.startsAt
  return useQuery({
    queryKey: ['organizations', String(organizationId), 'impact', p] as const,
    queryFn: () => previewImpact(organizationId, { vehicleId: p.vehicleId, instructorId: p.instructorId, startsAt: p.startsAt!, endsAt: p.endsAt! }),
    enabled: ready,
  })
}

// Bloqueios, manutenção e reatribuições mexem na agenda, nos veículos e nas notificações do espaço
function useInvalidateOrganization(organizationId: number) {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) })
}

export function useCreateBlock(organizationId: number) {
  const invalidate = useInvalidateOrganization(organizationId)
  return useMutation({
    mutationFn: (payload: BlockPayload) => createBlock(organizationId, payload),
    onSuccess: () => {
      notify.success('Bloqueio registrado.')
      return invalidate()
    },
  })
}

export function useReleaseBlock(organizationId: number) {
  const invalidate = useInvalidateOrganization(organizationId)
  return useMutation({
    mutationFn: ({ blockId, note }: { blockId: number; note: string | null }) => releaseBlock(organizationId, blockId, note),
    meta: { toastOnError: true },
    onSuccess: () => {
      notify.success('Bloqueio liberado. O histórico foi mantido.')
      return invalidate()
    },
  })
}

export function useCreateMaintenance(organizationId: number) {
  const invalidate = useInvalidateOrganization(organizationId)
  return useMutation({
    mutationFn: ({ input, block }: { input: MaintenanceInput; block: { starts_at: string; ends_at: string } | null }) => createMaintenance(organizationId, input, block),
    onSuccess: () => {
      notify.success('Manutenção registrada.')
      return invalidate()
    },
  })
}

export function useCompleteMaintenance(organizationId: number, maintenanceId: number) {
  const invalidate = useInvalidateOrganization(organizationId)
  return useMutation({
    mutationFn: (input: CompleteMaintenanceInput) => completeMaintenance(organizationId, maintenanceId, input),
    onSuccess: () => {
      notify.success('Serviço concluído e veículo liberado.')
      return invalidate()
    },
  })
}

export function useCancelMaintenance(organizationId: number) {
  const invalidate = useInvalidateOrganization(organizationId)
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string | null }) => cancelMaintenance(organizationId, id, reason),
    meta: { toastOnError: true },
    onSuccess: () => {
      notify.success('Manutenção cancelada.')
      return invalidate()
    },
  })
}

export function useSaveWeeklyHours(organizationId: number, instructorId: number) {
  const invalidate = useInvalidateOrganization(organizationId)
  return useMutation({
    mutationFn: (hours: WeeklyHours | null) => saveWeeklyHours(organizationId, instructorId, hours),
    onSuccess: () => {
      notify.success('Horário do instrutor salvo.')
      return invalidate()
    },
  })
}

export function useReassignLesson(organizationId: number) {
  const invalidate = useInvalidateOrganization(organizationId)
  return useMutation({
    mutationFn: ({ lessonId, ...input }: { lessonId: number; vehicle_id?: number | null; instructor_id?: number }) => reassignLesson(organizationId, lessonId, input),
    onSuccess: () => {
      notify.success('Aula atualizada.')
      return invalidate()
    },
  })
}
