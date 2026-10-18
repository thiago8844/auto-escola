import { LIST_PAGE_SIZE, PAGE_SIZE } from '../config/organization'
import type { VehicleInput } from '../schemas/vehicle'
import type { Paginated } from '../types/organization'
import type { Vehicle, VehicleStatus } from '../types/vehicle'
import { http } from './client'

const handledByScreen = { skipGlobalError: true } as const
const orNull = (value: string) => value.trim() || null

export type VehicleListParams = { page: number; search?: string; status?: VehicleStatus | ''; all?: boolean }

export async function listVehicles(organizationId: number | string, { page, search, status, all }: VehicleListParams): Promise<Paginated<Vehicle>> {
  const { data } = await http.get<Paginated<Vehicle>>(`/organizations/${organizationId}/vehicles`, {
    // `all` serve às listas de escolha (agendamento, filtros): traz até 100 de uma vez
    params: { per_page: all ? LIST_PAGE_SIZE : PAGE_SIZE, page, search: search || undefined, status: status || undefined },
    ...handledByScreen,
  })
  return data
}

export async function getVehicle(organizationId: number | string, vehicleId: number | string): Promise<Vehicle> {
  const { data } = await http.get<{ data: Vehicle }>(`/organizations/${organizationId}/vehicles/${vehicleId}`, handledByScreen)
  return data.data
}

function toPayload(input: VehicleInput) {
  return {
    plate: input.plate,
    brand: orNull(input.brand),
    model: input.model,
    year: input.year ? Number(input.year) : null,
    category: input.category,
    adapted: input.adapted,
    adaptations: input.adapted ? orNull(input.adaptations) : null,
    crlv_expires_at: orNull(input.crlv_expires_at),
    status: input.status,
    notes: orNull(input.notes),
  }
}

export async function createVehicle(organizationId: number | string, input: VehicleInput): Promise<Vehicle> {
  const { data } = await http.post<{ data: Vehicle }>(`/organizations/${organizationId}/vehicles`, toPayload(input), handledByScreen)
  return data.data
}

export async function updateVehicle(organizationId: number | string, vehicleId: number | string, input: VehicleInput): Promise<Vehicle> {
  const { data } = await http.patch<{ data: Vehicle }>(`/organizations/${organizationId}/vehicles/${vehicleId}`, toPayload(input), handledByScreen)
  return data.data
}
