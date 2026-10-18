import type { BalanceDetail, BalanceWarning, CreditEntry, ChargePolicy, ConsumeBasis } from '../types/balance'
import type { Paginated } from '../types/organization'
import { http } from './client'

const base = (organizationId: number | string, enrollmentId: number | string) => `/organizations/${organizationId}/enrollments/${enrollmentId}`
const handledByScreen = { skipGlobalError: true } as const

export async function getBalance(organizationId: number | string, enrollmentId: number | string): Promise<BalanceDetail> {
  const { data } = await http.get<{ data: BalanceDetail }>(`${base(organizationId, enrollmentId)}/balance`, handledByScreen)
  return data.data
}

export async function listCreditEntries(organizationId: number | string, enrollmentId: number | string, page: number): Promise<Paginated<CreditEntry>> {
  const { data } = await http.get<Paginated<CreditEntry>>(`${base(organizationId, enrollmentId)}/credit-entries`, {
    params: { page, per_page: 10 },
    ...handledByScreen,
  })
  return data
}

export type PackageInput = {
  kind: 'contract' | 'addition'
  description: string
  minutes: number
  reference_minutes: number | null
  price_cents: number | null
  category: string | null
  consume_basis: ConsumeBasis
  absence_charge: ChargePolicy
  late_cancel_charge: ChargePolicy
  cancel_notice_hours: number | null
}

export async function createPackage(organizationId: number | string, enrollmentId: number | string, input: PackageInput): Promise<BalanceDetail> {
  const { data } = await http.post<{ data: BalanceDetail }>(`${base(organizationId, enrollmentId)}/packages`, input, handledByScreen)
  return data.data
}

export async function adjustBalance(
  organizationId: number | string,
  enrollmentId: number | string,
  input: { minutes: number; category: string | null; reason: string },
): Promise<BalanceDetail> {
  const { data } = await http.post<{ data: BalanceDetail }>(`${base(organizationId, enrollmentId)}/credit-adjustments`, input, handledByScreen)
  return data.data
}

export async function reverseEntry(organizationId: number | string, enrollmentId: number | string, entryId: number, reason: string): Promise<BalanceDetail> {
  const { data } = await http.post<{ data: BalanceDetail }>(`${base(organizationId, enrollmentId)}/credit-entries/${entryId}/reversal`, { reason }, handledByScreen)
  return data.data
}

export type { BalanceWarning }
