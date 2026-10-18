import { LIST_PAGE_SIZE, PAGE_SIZE } from '../config/organization'
import type { VehicleInput } from '../schemas/vehicle'
import type { Commitment } from '../types/availability'
import type { Paginated } from '../types/organization'
import type { Vehicle, VehicleStatus } from '../types/vehicle'
import { http } from './client'
import { fetchAllPages } from './paginate'

const handledByScreen = { skipGlobalError: true } as const
const orNull = (value: string) => value.trim() || null

export type VehicleListParams = { page: number; search?: string; status?: VehicleStatus | ''; all?: boolean; archived?: boolean }

export async function listVehicles(organizationId: number | string, { page, search, status, all, archived }: VehicleListParams): Promise<Paginated<Vehicle>> {
  const request = async (current: number) => {
    const { data } = await http.get<Paginated<Vehicle>>(`/organizations/${organizationId}/vehicles`, {
      params: { per_page: all ? LIST_PAGE_SIZE : PAGE_SIZE, page: current, search: search || undefined, status: status || undefined, archived: archived ? 1 : undefined },
      ...handledByScreen,
    })
    return data
  }
  // `all` serve às listas de escolha (agendamento, filtros): junta todas as páginas
  return all ? fetchAllPages(request) : request(page)
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

// Inativar o veículo ou antecipar o CRLV não cancela nada: a API devolve os compromissos futuros afetados
export async function updateVehicle(organizationId: number | string, vehicleId: number | string, input: VehicleInput, expectedUpdatedAt?: string): Promise<{ vehicle: Vehicle; affected: Commitment[] }> {
  const { data } = await http.patch<{ data: Vehicle; meta?: { affected: Commitment[] } }>(
    `/organizations/${organizationId}/vehicles/${vehicleId}`,
    { ...toPayload(input), expected_updated_at: expectedUpdatedAt },
    handledByScreen,
  )
  return { vehicle: data.data, affected: data.meta?.affected ?? [] }
}
