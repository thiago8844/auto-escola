import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { changeMemberRole, listMembers, removeMember } from '../api/members'
import { queryKeys } from '../lib/queryKeys'
import { notify } from '../stores/toastStore'
import type { Role } from '../types/organization'

export function useMembers(organizationId: number, page: number) {
  return useQuery({
    queryKey: queryKeys.organizations.members(organizationId, page),
    queryFn: () => listMembers(organizationId, page),
    placeholderData: keepPreviousData,
  })
}

// Mudar papel ou remover pode alterar o meu próprio acesso: atualiza tudo do espaço
export function useChangeMemberRole(organizationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: Role }) => changeMemberRole(organizationId, userId, role),
    meta: { toastOnError: true },
    onSuccess: () => {
      notify.success('Papel atualizado.')
      return queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
    },
  })
}

export function useRemoveMember(organizationId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: number) => removeMember(organizationId, userId),
    meta: { toastOnError: true },
    onSuccess: () => {
      notify.success('Acesso removido.')
      return queryClient.invalidateQueries({ queryKey: queryKeys.organizations.all })
    },
  })
}
