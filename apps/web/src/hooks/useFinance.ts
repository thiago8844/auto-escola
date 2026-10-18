import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/finance'
import { notify } from '../stores/toastStore'

const key = (organizationId: number, name: string, params: object = {}) => ['organizations', String(organizationId), 'finance', name, params] as const

export const useOverview = (id: number, p: api.Params) => useQuery({ queryKey: key(id, 'overview', p), queryFn: () => api.getOverview(id, p), placeholderData: keepPreviousData })
export const useCashFlow = (id: number, p: api.Params) => useQuery({ queryKey: key(id, 'cash-flow', p), queryFn: () => api.getCashFlow(id, p), placeholderData: keepPreviousData })
export const useBreakdown = (id: number, p: api.Params) => useQuery({ queryKey: key(id, 'breakdown', p), queryFn: () => api.getBreakdown(id, p), placeholderData: keepPreviousData })
export const useConsolidated = (id: number, p: api.Params) => useQuery({ queryKey: key(id, 'consolidated', p), queryFn: () => api.getConsolidated(id, p), placeholderData: keepPreviousData })
export const useStatement = (id: number, accountId: number | null, p: api.Params) =>
  useQuery({ queryKey: key(id, 'statement', { accountId, ...p }), queryFn: () => api.getStatement(id, accountId!, p), enabled: accountId !== null, placeholderData: keepPreviousData })
export const useAccounts = (id: number) => useQuery({ queryKey: key(id, 'accounts'), queryFn: () => api.getAccounts(id) })
export const useCategories = (id: number) => useQuery({ queryKey: key(id, 'categories'), queryFn: () => api.getCategories(id) })
export const useMethods = (id: number) => useQuery({ queryKey: key(id, 'methods'), queryFn: () => api.getMethods(id) })
export const useParties = (id: number, search = '') => useQuery({ queryKey: key(id, 'parties', { search }), queryFn: () => api.getParties(id, search), placeholderData: keepPreviousData })
export const useRecurrences = (id: number) => useQuery({ queryKey: key(id, 'recurrences'), queryFn: () => api.getRecurrences(id) })
export const useFeeAdvances = (id: number) => useQuery({ queryKey: key(id, 'fee-advances'), queryFn: () => api.getFeeAdvances(id) })
export const useFinanceInstallments = (id: number, p: api.Params) => useQuery({ queryKey: key(id, 'installments', p), queryFn: () => api.listInstallments(id, p), placeholderData: keepPreviousData })
export const useEntry = (id: number, entryId: number | null) => useQuery({ queryKey: key(id, 'entry', { entryId }), queryFn: () => api.getEntry(id, entryId!), enabled: entryId !== null })
export const useMovements = (id: number, p: api.Params) => useQuery({ queryKey: key(id, 'movements', p), queryFn: () => api.listMovements(id, p), placeholderData: keepPreviousData })
export const useTransfers = (id: number, page: number) => useQuery({ queryKey: key(id, 'transfers', { page }), queryFn: () => api.listTransfers(id, page), placeholderData: keepPreviousData })
export const useReceipt = (id: number, paymentId: string) => useQuery({ queryKey: key(id, 'receipt', { paymentId }), queryFn: () => api.getReceipt(id, paymentId) })
export const useReconciliations = (id: number, accountId: number | null) => useQuery({ queryKey: key(id, 'reconciliations', { accountId }), queryFn: () => api.getReconciliations(id, accountId!), enabled: accountId !== null })
export const useEnrollmentFinance = (id: number, enrollmentId: number, enabled = true) =>
  useQuery({ queryKey: key(id, 'enrollment', { enrollmentId }), queryFn: () => api.getEnrollmentFinance(id, enrollmentId), enabled })

// Qualquer alteração financeira atualiza painel, listas, contas, alertas e os contextos de matrícula e manutenção
function useFinanceMutation<T, R>(id: number, mutationFn: (input: T) => Promise<R>, message?: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      if (message) notify.success(message)
      await queryClient.invalidateQueries({ queryKey: ['organizations', String(id)] })
    },
  })
}

export const usePreviewPlan = (id: number) => useMutation({ mutationFn: (body: Parameters<typeof api.previewPlan>[1]) => api.previewPlan(id, body) })
export const useCreateEntry = (id: number) => useFinanceMutation(id, (body: api.EntryInput) => api.createEntry(id, body), 'Lançamento salvo.')
export const useUpdateEntry = (id: number, entryId: number) => useFinanceMutation(id, (body: Record<string, unknown>) => api.updateEntry(id, entryId, body), 'Lançamento atualizado.')
export const useCancelEntry = (id: number) => useFinanceMutation(id, ({ entryId, reason }: { entryId: number; reason: string }) => api.cancelEntry(id, entryId, reason), 'Lançamento cancelado.')
export const useUpdateInstallment = (id: number) =>
  useFinanceMutation(id, ({ installmentId, ...body }: { installmentId: number; due_date?: string; amount_cents?: number }) => api.updateInstallment(id, installmentId, body), 'Parcela atualizada.')
export const useCancelInstallment = (id: number) => useFinanceMutation(id, ({ installmentId, reason }: { installmentId: number; reason: string }) => api.cancelInstallment(id, installmentId, reason), 'Parcela cancelada.')
export const usePayInstallment = (id: number) => useFinanceMutation(id, ({ installmentId, payments }: { installmentId: number; payments: api.PaymentLine[] }) => api.payInstallment(id, installmentId, payments), 'Baixa registrada.')
export const useConfirmPayment = (id: number) => useFinanceMutation(id, ({ paymentId, settledOn }: { paymentId: number; settledOn?: string }) => api.confirmPayment(id, paymentId, settledOn), 'Liquidação confirmada: o valor entrou na conta.')
export const useReversePayment = (id: number) => useFinanceMutation(id, ({ paymentId, reason }: { paymentId: number; reason: string }) => api.reversePayment(id, paymentId, reason), 'Pagamento estornado. O histórico foi mantido.')
export const useCreateAccount = (id: number) => useFinanceMutation(id, (body: Record<string, unknown>) => api.createAccount(id, body), 'Conta criada.')
export const useUpdateAccount = (id: number) => useFinanceMutation(id, ({ accountId, ...body }: { accountId: number } & Record<string, unknown>) => api.updateAccount(id, accountId, body), 'Conta atualizada.')
export const useAdjustAccount = (id: number) => useFinanceMutation(id, ({ accountId, ...body }: { accountId: number } & Record<string, unknown>) => api.adjustAccount(id, accountId, body), 'Saldo ajustado. O extrato anterior foi preservado.')
export const useReconcileAccount = (id: number) => useFinanceMutation(id, ({ accountId, ...body }: { accountId: number } & Record<string, unknown>) => api.reconcileAccount(id, accountId, body), 'Conferência registrada.')
export const useCreateTransfer = (id: number) => useFinanceMutation(id, (body: Record<string, unknown>) => api.createTransfer(id, body), 'Transferência registrada.')
export const useReverseTransfer = (id: number) => useFinanceMutation(id, ({ transferId, reason }: { transferId: number; reason: string }) => api.reverseTransfer(id, transferId, reason), 'Transferência estornada nas duas contas.')
export const useCreateCategory = (id: number) => useFinanceMutation(id, (body: Record<string, unknown>) => api.createCategory(id, body), 'Categoria criada.')
export const useUpdateCategory = (id: number) => useFinanceMutation(id, ({ categoryId, ...body }: { categoryId: number } & Record<string, unknown>) => api.updateCategory(id, categoryId, body))
export const useCreateMethod = (id: number) => useFinanceMutation(id, (body: Record<string, unknown>) => api.createMethod(id, body), 'Forma de pagamento criada.')
export const useUpdateMethod = (id: number) => useFinanceMutation(id, ({ methodId, ...body }: { methodId: number } & Record<string, unknown>) => api.updateMethod(id, methodId, body))
export const useCreateParty = (id: number) => useFinanceMutation(id, (body: Record<string, unknown>) => api.createParty(id, body), 'Favorecido cadastrado.')
export const useUpdateParty = (id: number) => useFinanceMutation(id, ({ partyId, ...body }: { partyId: number } & Record<string, unknown>) => api.updateParty(id, partyId, body))
export const useCreateRecurrence = (id: number) => useFinanceMutation(id, (body: Record<string, unknown>) => api.createRecurrence(id, body), 'Recorrência criada. Os lançamentos já foram gerados.')
export const useStopRecurrence = (id: number) => useFinanceMutation(id, (recurrenceId: number) => api.stopRecurrence(id, recurrenceId), 'Recorrência encerrada. O que já foi gerado permanece.')
export const useChargeFrom = (id: number) => useFinanceMutation(id, ({ path, body }: { path: string; body: Parameters<typeof api.chargeFrom>[2] }) => api.chargeFrom(id, path, body), 'Lançamento gerado.')
export const useExportCsv = (id: number) => useMutation({ mutationFn: ({ what, params }: { what: 'installments' | 'movements'; params: api.Params }) => api.exportCsv(id, what, params), meta: { toastOnError: true }, onSuccess: () => notify.success('Exportação pronta. O arquivo respeita os filtros da tela.') })

export const usePartnerFinance = (id: number, partnerId: number | null) =>
  useQuery({ queryKey: key(id, 'partner', { partnerId }), queryFn: () => api.getPartnerFinance(id, partnerId!), enabled: partnerId !== null })
