import type { PaymentMethodKind, Situation } from '../types/finance'

// Cor sempre acompanhada de texto e ícone
export const SITUATION: Record<Situation, { label: string; bg: string; icon: string }> = {
  forecast: { label: 'Prevista', bg: 'info', icon: 'bi-calendar-event' },
  overdue: { label: 'Vencida', bg: 'danger', icon: 'bi-exclamation-triangle-fill' },
  partial: { label: 'Parcialmente paga', bg: 'warning', icon: 'bi-hourglass-split' },
  paid: { label: 'Paga', bg: 'success', icon: 'bi-check-circle-fill' },
  cancelled: { label: 'Cancelada', bg: 'secondary', icon: 'bi-x-circle' },
}

export const SITUATION_ORDER: Situation[] = ['overdue', 'forecast', 'partial', 'paid', 'cancelled']

export const METHOD_KIND_LABELS: Record<PaymentMethodKind, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  transfer: 'Transferência',
  debit: 'Cartão de débito',
  credit: 'Cartão de crédito',
  boleto: 'Boleto',
  other: 'Outra',
}

export const MOVEMENT_KIND: Record<string, { label: string; icon: string }> = {
  payment_in: { label: 'Recebimento', icon: 'bi-arrow-down-circle' },
  payment_out: { label: 'Pagamento', icon: 'bi-arrow-up-circle' },
  payment_fee: { label: 'Taxa de pagamento', icon: 'bi-percent' },
  transfer_in: { label: 'Transferência (entrada)', icon: 'bi-arrow-left-right' },
  transfer_out: { label: 'Transferência (saída)', icon: 'bi-arrow-left-right' },
  adjustment: { label: 'Ajuste de saldo', icon: 'bi-sliders' },
  reversal: { label: 'Estorno', icon: 'bi-arrow-counterclockwise' },
}

export const PERIODICITY_LABELS = { monthly: 'Todo mês', biweekly: 'A cada 15 dias', weekly: 'Toda semana' } as const
