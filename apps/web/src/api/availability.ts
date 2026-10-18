import type { CompleteMaintenanceInput, MaintenanceInput } from '../schemas/availability'
import type { AvailabilityBlock, BlockKind, BlockResult, BlockScope, Commitment, InstructorAvailability, Maintenance, VehicleOverview, WeeklyHours } from '../types/availability'
import type { Lesson } from '../types/lesson'
import type { Paginated } from '../types/organization'
import { http } from './client'

const base = (organizationId: number | string) => `/organizations/${organizationId}`
const handledByScreen = { skipGlobalError: true } as const
const orNull = (value: string) => value.trim() || null
const cents = (value: string) => (value.trim() === '' ? null : Math.round(Number(value) * 100))
const intOrNull = (value: string) => (value.trim() === '' ? null : Number(value))

export type BlockListParams = { page: number; current?: boolean; resourceType?: 'vehicle' | 'instructor'; vehicleId?: string; instructorId?: string }

export async function listBlocks(organizationId: number | string, p: BlockListParams): Promise<Paginated<AvailabilityBlock>> {
  const { data } = await http.get<Paginated<AvailabilityBlock>>(`${base(organizationId)}/availability-blocks`, {
    params: { page: p.page, per_page: 15, current: p.current ? 1 : undefined, resource_type: p.resourceType, vehicle_id: p.vehicleId, instructor_id: p.instructorId },
    ...handledByScreen,
  })
  return data
}

export type BlockPayload = {
  resource_type: 'vehicle' | 'instructor'
  vehicle_id?: number
  instructor_id?: number
  scope?: BlockScope
  kind: BlockKind
  starts_at: string
  ends_at: string
  reason: string
}

type BlockResponse = { data: AvailabilityBlock; meta: { affected: Commitment[]; external_affected: number } }
const toResult = (r: BlockResponse): BlockResult => ({ block: r.data, affected: r.meta.affected, external_affected: r.meta.external_affected })

export async function createBlock(organizationId: number | string, payload: BlockPayload): Promise<BlockResult> {
  const { data } = await http.post<BlockResponse>(`${base(organizationId)}/availability-blocks`, payload, handledByScreen)
  return toResult(data)
}

export async function releaseBlock(organizationId: number | string, blockId: number, note: string | null): Promise<AvailabilityBlock> {
  const { data } = await http.post<{ data: AvailabilityBlock }>(`${base(organizationId)}/availability-blocks/${blockId}/release`, { note }, handledByScreen)
  return data.data
}

// Prévia: quantos compromissos um bloqueio nesse período afetaria (não grava nada)
export async function previewImpact(
  organizationId: number | string,
  p: { vehicleId?: string; instructorId?: string; startsAt: string; endsAt: string },
): Promise<Commitment[]> {
  const { data } = await http.get<{ data: Commitment[] }>(`${base(organizationId)}/availability-blocks/impact`, {
    params: { vehicle_id: p.vehicleId || undefined, instructor_id: p.instructorId || undefined, starts_at: p.startsAt, ends_at: p.endsAt },
    ...handledByScreen,
  })
  return data.data
}

export async function listMaintenances(organizationId: number | string, p: { page: number; status?: string; vehicleId?: string }): Promise<Paginated<Maintenance>> {
  const { data } = await http.get<Paginated<Maintenance>>(`${base(organizationId)}/maintenances`, {
    params: { page: p.page, per_page: 15, status: p.status || undefined, vehicle_id: p.vehicleId || undefined },
    ...handledByScreen,
  })
  return data
}

export async function createMaintenance(
  organizationId: number | string,
  input: MaintenanceInput,
  block: { starts_at: string; ends_at: string } | null,
): Promise<{ maintenance: Maintenance; affected: Commitment[] }> {
  const { data } = await http.post<{ data: Maintenance; meta: { affected: Commitment[] } }>(
    `${base(organizationId)}/maintenances`,
    {
      vehicle_id: Number(input.vehicle_id),
      type: input.type,
      scheduled_on: input.scheduled_on,
      provider: orNull(input.provider),
      odometer_km: intOrNull(input.odometer_km),
      estimated_cost_cents: cents(input.estimated_cost),
      notes: orNull(input.notes),
      block: block ?? undefined,
    },
    handledByScreen,
  )
  return { maintenance: data.data, affected: data.meta.affected }
}

export async function completeMaintenance(organizationId: number | string, id: number, input: CompleteMaintenanceInput): Promise<Maintenance> {
  const { data } = await http.post<{ data: Maintenance }>(
    `${base(organizationId)}/maintenances/${id}/complete`,
    {
      performed_on: input.performed_on,
      actual_cost_cents: cents(input.actual_cost),
      odometer_km: intOrNull(input.odometer_km),
      next_due_date: orNull(input.next_due_date),
      next_due_km: intOrNull(input.next_due_km),
      notes: orNull(input.notes),
    },
    handledByScreen,
  )
  return data.data
}

export async function cancelMaintenance(organizationId: number | string, id: number, reason: string | null): Promise<Maintenance> {
  const { data } = await http.post<{ data: Maintenance }>(`${base(organizationId)}/maintenances/${id}/cancel`, { reason }, handledByScreen)
  return data.data
}

export async function getVehicleOverview(organizationId: number | string, vehicleId: number | string): Promise<VehicleOverview> {
  const { data } = await http.get<{ data: VehicleOverview }>(`${base(organizationId)}/vehicles/${vehicleId}/overview`, handledByScreen)
  return data.data
}

export async function getInstructorAvailability(organizationId: number | string, instructorId: number | string): Promise<InstructorAvailability> {
  const { data } = await http.get<{ data: InstructorAvailability }>(`${base(organizationId)}/instructors/${instructorId}/availability`, handledByScreen)
  return data.data
}

export async function saveWeeklyHours(organizationId: number | string, instructorId: number | string, hours: WeeklyHours | null): Promise<WeeklyHours | null> {
  const { data } = await http.put<{ data: { weekly_hours: WeeklyHours | null } }>(
    `${base(organizationId)}/instructors/${instructorId}/weekly-hours`,
    { weekly_hours: hours },
    handledByScreen,
  )
  return data.data.weekly_hours
}

// Providência para compromisso afetado: trocar veículo e/ou instrutor sem mexer no horário
export async function reassignLesson(organizationId: number | string, lessonId: number, input: { vehicle_id?: number | null; instructor_id?: number }): Promise<Lesson> {
  const { data } = await http.post<{ data: Lesson }>(`${base(organizationId)}/lessons/${lessonId}/reassign`, input, handledByScreen)
  return data.data
}
