import type { OrganizationInput, OrganizationUpdateInput } from '../schemas/organization'
import type { Organization, Paginated } from '../types/organization'
import { LIST_PAGE_SIZE } from '../config/organization'
import { http } from './client'

const handledByScreen = { skipGlobalError: true } as const

// Campos de texto vazios viram null, para limpar o dado no PATCH
const orNull = (value: string) => value.trim() || null

export async function listOrganizations(): Promise<Paginated<Organization>> {
  const { data } = await http.get<Paginated<Organization>>('/organizations', {
    params: { per_page: LIST_PAGE_SIZE },
    ...handledByScreen,
  })
  return data
}

export async function getOrganization(id: number | string): Promise<Organization> {
  const { data } = await http.get<{ data: Organization }>(`/organizations/${id}`, handledByScreen)
  return data.data
}

export async function createOrganization(input: OrganizationInput): Promise<Organization> {
  const { data } = await http.post<{ data: Organization }>(
    '/organizations',
    {
      name: input.name,
      type: input.type,
      document: orNull(input.document),
      email: orNull(input.email),
      phone: orNull(input.phone),
    },
    handledByScreen,
  )
  return data.data
}

export async function updateOrganization(id: number | string, input: OrganizationUpdateInput): Promise<Organization> {
  const { data } = await http.patch<{ data: Organization }>(
    `/organizations/${id}`,
    {
      name: input.name,
      document: orNull(input.document),
      email: orNull(input.email),
      phone: orNull(input.phone),
    },
    handledByScreen,
  )
  return data.data
}
