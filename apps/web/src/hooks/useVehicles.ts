import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createVehicle, getVehicle, listVehicles, updateVehicle, type VehicleListParams } from '../api/vehicles'
import { queryKeys } from '../lib/queryKeys'
import type { VehicleInput } from '../schemas/vehicle'

export function useVehicles(organizationId: number, params: VehicleListParams) {
  return useQuery({
    queryKey: queryKeys.organizations.vehicles(organizationId, params),
    queryFn: () => listVehicles(organizationId, params),
    placeholderData: keepPreviousData,
  })
}

export function useVehicle(organizationId: number, vehicleId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.vehicle(organizationId, vehicleId ?? ''),
    queryFn: () => getVehicle(organizationId, vehicleId!),
    enabled: !!vehicleId,
  })
}

export function useCreateVehicle(organizationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: VehicleInput) => createVehicle(organizationId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }),
  })
}

export function useUpdateVehicle(organizationId: number, vehicleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: VehicleInput) => updateVehicle(organizationId, vehicleId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }),
  })
}
