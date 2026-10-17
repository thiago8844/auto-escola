import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { acceptInvitation, createInvitation, listInvitations, revokeInvitation } from '../api/invitations'
import { queryKeys } from '../lib/queryKeys'
import type { InvitationInput } from '../schemas/invitation'
import { notify } from '../stores/toastStore'

export function useInvitations(organizationId: number, page: number) {
  return useQuery({
    queryKey: queryKeys.organizations.invitations(organizationId, page),
    queryFn: () => listInvitations(organizationId, page),
    placeholderData: keepPreviousData,
  })
}

export function useCreateInvitation(organizationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: InvitationInput) => createInvitation(organizationId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.invitationsAll(organizationId) }),
  })
}

export function useRevokeInvitation(organizationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (invitationId: number) => revokeInvitation(organizationId, invitationId),
    meta: { toastOnError: true },
    onSuccess: () => {
      notify.success('Convite cancelado.')
      return queryClient.invalidateQueries({ queryKey: queryKeys.organizations.invitationsAll(organizationId) })
    },
  })
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: acceptInvitation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all }),
  })
}
