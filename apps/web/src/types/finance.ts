export type EntryType = 'receivable' | 'payable'

export type Situation = 'forecast' | 'overdue' | 'partial' | 'paid' | 'cancelled'

export type FinanceAccount = {
  id: number
  name: string
  kind: 'bank' | 'cash'
  institution: string | null
  identification: string | null
  opening_balance_cents: number
  opening_date: string
  active: boolean
  balance_cents: number | null
}

export type FinanceCategory = { id: number; name: string; type: 'income' | 'expense'; is_pass_through: boolean; active: boolean }

export type PaymentMethodKind = 'cash' | 'pix' | 'transfer' | 'debit' | 'credit' | 'boleto' | 'other'

export type FinanceMethod = { id: number; name: string; kind: PaymentMethodKind; settlement_days: number; active: boolean }

export type FinanceParty = { id: number; name: string; document: string | null; email: string | null; phone: string | null; notes: string | null; active: boolean }

export type FinanceRecurrence = {
  id: number
  type: EntryType
  description: string
  category_id: number
  student_id: number | null
  partner_id: number | null
  party_id: number | null
  amount_cents: number
  day_of_month: number
  starts_on: string
  ends_on: string | null
  active: boolean
}

export type Payment = {
  id: number
  installment_id: number
  status: 'pending' | 'confirmed' | 'reversed'
  paid_on: string
  expected_on: string | null
  settled_on: string | null
  applied_cents: number
  discount_cents: number
  interest_cents: number
  fine_cents: number
  fee_cents: number
  gross_cents: number
  net_cents: number
  adjust_reason: string | null
  reference: string | null
  notes: string | null
  account: { id: number; name?: string }
  method: { id: number; name?: string; kind?: PaymentMethodKind }
  created_by: { id: number; name: string } | null
  reversed_at: string | null
  reverse_reason: string | null
  receipt_number: string
}

export type EntrySummary = {
  id: number
  type: EntryType
  description: string
  status: 'active' | 'cancelled'
  installments_count: number
  total_cents: number
  issued_on: string
  category: { id: number; name?: string; is_pass_through?: boolean }
  student: { id: number; name: string } | null
  partner: { id: number; name: string } | null
  party: { id: number; name: string } | null
  enrollment_id: number | null
  vehicle_id: number | null
  maintenance_id: number | null
  external_fee_id: number | null
  source_ref: string | null
}

export type Installment = {
  id: number
  entry_id: number
  number: number
  due_date: string
  amount_cents: number
  paid_cents: number
  outstanding_cents: number
  status: 'open' | 'paid' | 'cancelled'
  paid_on: string | null
  awaiting_settlement_cents: number
  situation: Situation | null
  entry: EntrySummary | null
  payments: Payment[] | null
}

export type Entry = EntrySummary & {
  notes: string | null
  recurrence_id: number | null
  cancelled_at: string | null
  cancel_reason: string | null
  created_by: { id: number; name: string } | null
  installments: Installment[]
  paid_cents: number
  outstanding_cents: number
}

export type SituationTotals = Record<Situation, { count: number; amount_cents: number; outstanding_cents: number }>

export type InstallmentList = {
  data: Installment[]
  meta: { current_page: number; last_page: number; per_page: number; total: number }
  totals: { count: number; amount_cents: number; outstanding_cents: number; by_situation: SituationTotals }
}

export type PlannedInstallment = { number: number; due_date: string; amount_cents: number }

export type Overview = {
  period: { from: string; to: string }
  receivable: { outstanding_cents: number; overdue: { count: number; cents: number }; next_30_days_cents: number }
  payable: { outstanding_cents: number; overdue: { count: number; cents: number }; next_30_days_cents: number }
  realized: {
    receipts_cents: number
    pass_through_in_cents: number
    payments_cents: number
    pass_through_out_cents: number
    fees_cents: number
    adjustments_cents: number
    transfers_in_cents: number
    transfers_out_cents: number
  }
  accounts: Array<{ id: number; name: string; kind: 'bank' | 'cash'; active: boolean; balance_cents: number }>
  consolidated_balance_cents: number
  awaiting_settlement: { in_cents: number; out_cents: number }
  basis: string
}

export type CashFlow = {
  by: 'day' | 'month'
  period: { from: string; to: string }
  rows: Array<{ bucket: string; realized_in_cents: number; realized_out_cents: number; forecast_in_cents: number; forecast_out_cents: number }>
}

export type StatementLine = {
  id: number
  date: string
  kind: string
  direction: 'in' | 'out'
  amount_cents: number
  description: string
  payment_id: number | null
  transfer_id: number | null
  entry_id: number | null
  reconciled: boolean
  balance_cents: number
}

export type Statement = {
  account: { id: number; name: string; kind: string; active: boolean }
  period: { from: string; to: string }
  opening_balance_cents: number
  total_in_cents: number
  total_out_cents: number
  closing_balance_cents: number
  current_balance_cents: number
  breakdown: Record<string, number>
  lines: StatementLine[]
}

export type Consolidated = {
  period: { from: string; to: string }
  opening_balance_cents: number
  total_in_cents: number
  total_out_cents: number
  transfers_cents: number
  closing_balance_cents: number
  realized: Overview['realized']
  accounts: Array<{ account: { id: number; name: string }; opening_balance_cents: number; total_in_cents: number; total_out_cents: number; closing_balance_cents: number }>
}

export type Transfer = {
  id: number
  from_account: { id: number; name: string | null }
  to_account: { id: number; name: string | null }
  amount_cents: number
  occurred_on: string
  reason: string
  reversed_at: string | null
  reverse_reason: string | null
}

export type Reconciliation = { id: number; account_id: number; statement_date: string; statement_balance_cents: number; system_balance_cents: number; difference_cents: number; notes: string | null; created_at: string | null }

export type FeeAdvance = {
  fee_id: number
  kind: string
  student: string | null
  amount_cents: number | null
  obligor: string
  paid_by: string | null
  reimbursement: 'none' | 'to_settle' | 'settled'
  status: string
  reimbursement_entry_id: number | null
  advance_entry_id: number | null
  to_settle_cents: number
}

export type Receipt = {
  entry_type: EntryType
  entry_id: number
  number: string
  kind: string
  status: string
  organization: { name: string; document: string | null; address: string | null; city: string | null; state: string | null; phone: string | null }
  counterparty: string | null
  description: string
  installment: string
  payment: Payment
  notice: string
}

export type EnrollmentFinance = {
  entries: Entry[]
  charged_cents: number
  received_cents: number
  packages: Array<{ id: number; description: string | null; price_cents: number | null; charged: boolean }>
}

export type BreakdownRow = { id: number | null; label: string; received_cents: number; paid_cents: number }
