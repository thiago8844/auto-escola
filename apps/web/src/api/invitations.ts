import { PAGE_SIZE } from '../config/organization'
import type { InvitationInput } from '../schemas/invitation'
import type { Invitation, Paginated } from '../types/organization'
import { http } from './client'

export async function listInvitations(organizationId: number | string, page: number): Promise<Paginated<Invitation>> {
  const { data } = await http.get<Paginated<Invitation>>(`/organizations/${organizationId}/invitations`, {
    params: { per_page: PAGE_SIZE, page },
    skipGlobalError: true,
  })
  return data
}

export async function createInvitation(organizationId: number | string, input: InvitationInput): Promise<Invitation> {
  const { data } = await http.post<{ data: Invitation }>(`/organizations/${organizationId}/invitations`, input, {
    skipGlobalError: true,
  })
  return data.data
}

export async function revokeInvitation(organizationId: number | string, invitationId: number): Promise<void> {
  await http.delete(`/organizations/${organizationId}/invitations/${invitationId}`)
}

export async function acceptInvitation(token: string): Promise<Invitation> {
  const { data } = await http.post<{ data: Invitation }>('/invitations/accept', { token }, { skipGlobalError: true })
  return data.data
}
