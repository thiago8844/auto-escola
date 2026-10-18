import type { BreakdownRow, CashFlow, Consolidated, Entry, EntryType, EnrollmentFinance, FeeAdvance, FinanceAccount, FinanceCategory, FinanceMethod, FinanceParty, FinanceRecurrence, InstallmentList, Overview, Payment, PlannedInstallment, Receipt, Reconciliation, Statement, Transfer } from '../types/finance'
import type { Paginated } from '../types/organization'
import { http } from './client'

const base = (organizationId: number | string) => `/organizations/${organizationId}/finance`
const handledByScreen = { skipGlobalError: true } as const
export type Params = Record<string, string | number | undefined | null>
const clean = (params: Params) => Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''))

async function get<T>(organizationId: number | string, path: string, params: Params = {}): Promise<T> {
  const { data } = await http.get<{ data: T }>(`${base(organizationId)}${path}`, { params: clean(params), ...handledByScreen })
  return data.data
}

async function send<T>(method: 'post' | 'patch' | 'delete', organizationId: number | string, path: string, body?: unknown): Promise<T> {
  const { data } = await http.request<{ data: T }>({ method, url: `${base(organizationId)}${path}`, data: body, ...handledByScreen })
  return data.data
}

// ---- consulta
export const getOverview = (id: number | string, p: Params) => get<Overview>(id, '/overview', p)
export const getCashFlow = (id: number | string, p: Params) => get<CashFlow>(id, '/cash-flow', p)
export const getBreakdown = (id: number | string, p: Params) => get<{ period: { from: string; to: string }; by: string; rows: BreakdownRow[] }>(id, '/breakdown', p)
export const getConsolidated = (id: number | string, p: Params) => get<Consolidated>(id, '/statement', p)
export const getStatement = (id: number | string, accountId: number, p: Params) => get<Statement>(id, `/accounts/${accountId}/statement`, p)
export const getAccounts = (id: number | string) => get<FinanceAccount[]>(id, '/accounts')
export const getCategories = (id: number | string) => get<FinanceCategory[]>(id, '/categories')
export const getMethods = (id: number | string) => get<FinanceMethod[]>(id, '/payment-methods')
export const getParties = (id: number | string, search = '') => get<FinanceParty[]>(id, '/parties', { search })
export const getRecurrences = (id: number | string) => get<FinanceRecurrence[]>(id, '/recurrences')
export const getFeeAdvances = (id: number | string) => get<FeeAdvance[]>(id, '/fee-advances')
export const getEntry = (id: number | string, entryId: number) => get<Entry>(id, `/entries/${entryId}`)
export const getReceipt = (id: number | string, paymentId: number | string) => get<Receipt>(id, `/payments/${paymentId}/receipt`)
export const getReconciliations = (id: number | string, accountId: number) => get<Reconciliation[]>(id, `/accounts/${accountId}/reconciliations`)
export const getEnrollmentFinance = async (id: number | string, enrollmentId: number | string) => {
  const { data } = await http.get<{ data: EnrollmentFinance }>(`/organizations/${id}/enrollments/${enrollmentId}/finance`, handledByScreen)
  return data.data
}

export async function listInstallments(id: number | string, p: Params): Promise<InstallmentList> {
  const { data } = await http.get<InstallmentList>(`${base(id)}/installments`, { params: clean({ per_page: 15, ...p }), ...handledByScreen })
  return data
}

export async function listMovements(id: number | string, p: Params): Promise<Paginated<{ id: number; date: string; account: { id: number; name: string | null }; kind: string; direction: 'in' | 'out'; amount_cents: number; description: string; reconciled: boolean }>> {
  const { data } = await http.get(`${base(id)}/movements`, { params: clean({ per_page: 15, ...p }), ...handledByScreen })
  return data
}

export async function listTransfers(id: number | string, page: number): Promise<Paginated<Transfer>> {
  const { data } = await http.get<Paginated<Transfer>>(`${base(id)}/transfers`, { params: { page, per_page: 10 }, ...handledByScreen })
  return data
}

// ---- lançamentos e baixas
export type PlanInput = { count: number; first_due: string; periodicity: 'monthly' | 'biweekly' | 'weekly' }

export type EntryInput = {
  type: EntryType
  description: string
  category_id: number
  student_id?: number | null
  partner_id?: number | null
  party_id?: number | null
  enrollment_id?: number | null
  total_cents: number
  issued_on: string
  plan?: PlanInput
  installments?: Array<{ due_date: string; amount_cents: number }>
  paid?: { account_id: number; method_id: number; paid_on: string; reference?: string | null }
  notes?: string | null
}

export const previewPlan = (id: number | string, body: { total_cents: number; count: number; first_due: string; periodicity: string }) => send<PlannedInstallment[]>('post', id, '/entries/preview', body)
export const createEntry = (id: number | string, body: EntryInput) => send<Entry>('post', id, '/entries', body)
export const updateEntry = (id: number | string, entryId: number, body: Record<string, unknown>) => send<Entry>('patch', id, `/entries/${entryId}`, body)
export const cancelEntry = (id: number | string, entryId: number, reason: string) => send<Entry>('post', id, `/entries/${entryId}/cancel`, { reason })
export const updateInstallment = (id: number | string, installmentId: number, body: { due_date?: string; amount_cents?: number }) => send<Entry>('patch', id, `/installments/${installmentId}`, body)
export const cancelInstallment = (id: number | string, installmentId: number, reason: string) => send<Entry>('post', id, `/installments/${installmentId}/cancel`, { reason })

export type PaymentLine = {
  account_id: number
  method_id: number
  paid_on: string
  applied_cents: number
  discount_cents?: number
  interest_cents?: number
  fine_cents?: number
  fee_cents?: number
  adjust_reason?: string | null
  reference?: string | null
  client_ref?: string
}

export const payInstallment = (id: number | string, installmentId: number, payments: PaymentLine[]) => send<Entry>('post', id, `/installments/${installmentId}/payments`, { payments })
export const confirmPayment = (id: number | string, paymentId: number, settledOn?: string) => send<Payment>('post', id, `/payments/${paymentId}/confirm`, { settled_on: settledOn })
export const reversePayment = (id: number | string, paymentId: number, reason: string) => send<Entry>('post', id, `/payments/${paymentId}/reverse`, { reason })

// ---- contas
export const createAccount = (id: number | string, body: Record<string, unknown>) => send<FinanceAccount>('post', id, '/accounts', body)
export const updateAccount = (id: number | string, accountId: number, body: Record<string, unknown>) => send<FinanceAccount>('patch', id, `/accounts/${accountId}`, body)
export const adjustAccount = (id: number | string, accountId: number, body: Record<string, unknown>) => send<FinanceAccount>('post', id, `/accounts/${accountId}/adjustments`, body)
export const reconcileAccount = (id: number | string, accountId: number, body: Record<string, unknown>) => send<Reconciliation>('post', id, `/accounts/${accountId}/reconciliations`, body)
export const createTransfer = (id: number | string, body: Record<string, unknown>) => send<Transfer>('post', id, '/transfers', body)
export const reverseTransfer = (id: number | string, transferId: number, reason: string) => send<Transfer>('post', id, `/transfers/${transferId}/reverse`, { reason })

// ---- cadastros
export const createCategory = (id: number | string, body: Record<string, unknown>) => send<FinanceCategory>('post', id, '/categories', body)
export const updateCategory = (id: number | string, categoryId: number, body: Record<string, unknown>) => send<FinanceCategory>('patch', id, `/categories/${categoryId}`, body)
export const createMethod = (id: number | string, body: Record<string, unknown>) => send<FinanceMethod>('post', id, '/payment-methods', body)
export const updateMethod = (id: number | string, methodId: number, body: Record<string, unknown>) => send<FinanceMethod>('patch', id, `/payment-methods/${methodId}`, body)
export const createParty = (id: number | string, body: Record<string, unknown>) => send<FinanceParty>('post', id, '/parties', body)
export const updateParty = (id: number | string, partyId: number, body: Record<string, unknown>) => send<FinanceParty>('patch', id, `/parties/${partyId}`, body)
export const createRecurrence = (id: number | string, body: Record<string, unknown>) => send<FinanceRecurrence>('post', id, '/recurrences', body)
export const stopRecurrence = (id: number | string, recurrenceId: number) => send<FinanceRecurrence>('delete', id, `/recurrences/${recurrenceId}`)

// ---- integrações (ação explícita; repetir devolve 409 com o lançamento existente)
type ChargeBody = { package_id?: number; total_cents?: number; plan?: PlanInput; installments?: Array<{ due_date: string; amount_cents: number }>; payer?: 'student' | 'partner'; party_id?: number | null; due_date?: string }

export async function chargeFrom(organizationId: number | string, path: string, body: ChargeBody): Promise<Entry> {
  const { data } = await http.post<{ data: Entry }>(`/organizations/${organizationId}${path}`, body, handledByScreen)
  return data.data
}

export async function exportCsv(organizationId: number | string, what: 'installments' | 'movements', params: Params): Promise<void> {
  const response = await http.get<Blob>(`${base(organizationId)}/export/${what}`, { params: clean(params), responseType: 'blob', ...handledByScreen })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = `financeiro-${what === 'installments' ? 'parcelas' : 'movimentacoes'}-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export type PartnerFinance = {
  partner: { id: number; name: string }
  receivable: { total_cents: number; received_cents: number; outstanding_cents: number }
  payable: { total_cents: number; paid_cents: number; outstanding_cents: number }
  basis: string
}

export const getPartnerFinance = (id: number | string, partnerId: number | string) => get<PartnerFinance>(id, `/partners/${partnerId}`)
