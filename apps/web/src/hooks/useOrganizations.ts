import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createOrganization, getOrganization, listOrganizations, updateOrganization } from '../api/organizations'
import { queryKeys } from '../lib/queryKeys'
import type { OrganizationUpdateInput } from '../schemas/organization'

export function useOrganizations() {
  return useQuery({ queryKey: queryKeys.organizations.all, queryFn: listOrganizations })
}

export function useOrganization(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.organizations.detail(id ?? ''),
    queryFn: () => getOrganization(id!),
    enabled: !!id,
  })
}

export function useCreateOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createOrganization,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all }),
  })
}

export function useUpdateOrganization(id: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: OrganizationUpdateInput) => updateOrganization(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all }),
  })
}
