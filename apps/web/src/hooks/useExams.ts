import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  changeFeeStatus,
  createExam,
  getExam,
  listExams,
  listFees,
  recordExamResult,
  rescheduleExam,
  saveFee,
  settleReimbursement,
  updateExam,
  uploadExamDocument,
  type ExamEditInputPayload,
  type ExamInput,
  type ExamListParams,
  type FeeInput,
  type FeeListParams,
} from '../api/exams'
import { queryKeys } from '../lib/queryKeys'
import { notify } from '../stores/toastStore'
import type { ExamStatus, FeeParty, FeeStatus } from '../types/exam'

export function useExams(organizationId: number, params: ExamListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.organizations.exams(organizationId, params),
    queryFn: () => listExams(organizationId, params),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useExam(organizationId: number, examId: string) {
  return useQuery({
    queryKey: queryKeys.organizations.exam(organizationId, examId),
    queryFn: () => getExam(organizationId, examId),
  })
}

export function useFees(organizationId: number, params: FeeListParams, enabled = true) {
  return useQuery({
    queryKey: queryKeys.organizations.fees(organizationId, params),
    queryFn: () => listFees(organizationId, params),
    enabled,
  })
}

// Exame e taxa alteram processo, desfecho, linha do tempo e notificações: tudo do espaço é atualizado
function useExamMutation<T, R>(organizationId: number, mutationFn: (input: T) => Promise<R>, message: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      notify.success(message)
      return queryClient.invalidateQueries({ queryKey: queryKeys.organizations.detail(organizationId) })
    },
  })
}

export const useCreateExam = (organizationId: number) => useExamMutation(organizationId, (input: ExamInput) => createExam(organizationId, input), 'Exame agendado.')

export const useUpdateExam = (organizationId: number, examId: number) =>
  useExamMutation(organizationId, (input: Partial<ExamEditInputPayload>) => updateExam(organizationId, examId, input), 'Exame atualizado.')

export const useRescheduleExam = (organizationId: number, examId: number) =>
  useExamMutation(
    organizationId,
    (input: Parameters<typeof rescheduleExam>[2]) => rescheduleExam(organizationId, examId, input),
    'Exame remarcado; a data e o local anteriores ficaram no histórico.',
  )

export const useExamResult = (organizationId: number, examId: number, correction: boolean) =>
  useExamMutation(
    organizationId,
    ({ status, reason }: { status: ExamStatus; reason: string | null }) => recordExamResult(organizationId, examId, status, reason, correction),
    correction ? 'Resultado corrigido; o anterior ficou na linha do tempo.' : 'Resultado registrado.',
  )

export const useSaveFee = (organizationId: number, feeId: number | null) =>
  useExamMutation(organizationId, (input: FeeInput) => saveFee(organizationId, feeId, input), feeId ? 'Taxa atualizada.' : 'Taxa registrada.')

export const useFeeStatus = (organizationId: number, feeId: number) =>
  useExamMutation(
    organizationId,
    (input: { status: FeeStatus; reason: string | null; paid_by: FeeParty | null; receipt_document_id?: number | null }) => changeFeeStatus(organizationId, feeId, input),
    'Situação da taxa atualizada.',
  )

export const useSettleReimbursement = (organizationId: number) =>
  useExamMutation(organizationId, (feeId: number) => settleReimbursement(organizationId, feeId), 'Reembolso acertado.')

export const useUploadExamDocument = (organizationId: number) =>
  useExamMutation(organizationId, (input: Parameters<typeof uploadExamDocument>[1]) => uploadExamDocument(organizationId, input), 'Documento anexado.')
