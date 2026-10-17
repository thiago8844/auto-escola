import { LIST_PAGE_SIZE } from '../config/organization'
import type { Member, Paginated, Role } from '../types/organization'
import { http } from './client'

export async function listMembers(organizationId: number | string): Promise<Paginated<Member>> {
  const { data } = await http.get<Paginated<Member>>(`/organizations/${organizationId}/members`, {
    params: { per_page: LIST_PAGE_SIZE },
    skipGlobalError: true,
  })
  return data
}

export async function changeMemberRole(organizationId: number | string, userId: number, role: Role): Promise<void> {
  await http.patch(`/organizations/${organizationId}/members/${userId}`, { role })
}

export async function removeMember(organizationId: number | string, userId: number): Promise<void> {
  await http.delete(`/organizations/${organizationId}/members/${userId}`)
}
