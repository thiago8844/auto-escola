import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPartner, getPartner, listPartners, updatePartner, type PartnerListParams } from '../api/partners'
import { queryKeys } from '../lib/queryKeys'
import type { PartnerInput } from '../schemas/partner'

export function usePartners(organizationId: number, params: PartnerListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.organizations.partners(organizationId, params),
    queryFn: () => listPartners(organizationId, params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function usePartner(organizationId: number, partnerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.partner(organizationId, partnerId ?? ''),
    queryFn: () => getPartner(organizationId, partnerId!),
    enabled: !!partnerId,
  })
}

export function useCreatePartner(organizationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PartnerInput) => createPartner(organizationId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }),
  })
}

export function useUpdatePartner(organizationId: number, partnerId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PartnerInput) => updatePartner(organizationId, partnerId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) }),
  })
}
