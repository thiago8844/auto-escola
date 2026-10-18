import { LIST_PAGE_SIZE, PAGE_SIZE } from '../config/organization'
import type { PartnerInput } from '../schemas/partner'
import type { Paginated } from '../types/organization'
import type { Partner } from '../types/partner'
import { http } from './client'
import { fetchAllPages } from './paginate'

const handledByScreen = { skipGlobalError: true } as const
const base = (organizationId: number | string) => `/organizations/${organizationId}/partners`
const orNull = (value: string) => value.trim() || null

export type PartnerListParams = { page: number; search?: string; all?: boolean; archived?: boolean }

export async function listPartners(organizationId: number | string, { page, search, all, archived }: PartnerListParams): Promise<Paginated<Partner>> {
  const request = async (current: number) => {
    const { data } = await http.get<Paginated<Partner>>(base(organizationId), {
      params: { per_page: all ? LIST_PAGE_SIZE : PAGE_SIZE, page: current, search: search || undefined, archived: archived ? 1 : undefined },
      ...handledByScreen,
    })
    return data
  }
  return all ? fetchAllPages(request) : request(page)
}

export async function getPartner(organizationId: number | string, partnerId: number | string): Promise<Partner> {
  const { data } = await http.get<{ data: Partner }>(`${base(organizationId)}/${partnerId}`, handledByScreen)
  return data.data
}

function toPayload(input: PartnerInput) {
  return { name: input.name, document: orNull(input.document), email: orNull(input.email), phone: orNull(input.phone) }
}

export async function createPartner(organizationId: number | string, input: PartnerInput): Promise<Partner> {
  const { data } = await http.post<{ data: Partner }>(base(organizationId), toPayload(input), handledByScreen)
  return data.data
}

export async function updatePartner(organizationId: number | string, partnerId: number | string, input: PartnerInput, expectedUpdatedAt?: string): Promise<Partner> {
  const { data } = await http.patch<{ data: Partner }>(`${base(organizationId)}/${partnerId}`, { ...toPayload(input), expected_updated_at: expectedUpdatedAt }, handledByScreen)
  return data.data
}
