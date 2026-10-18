export type CreditBucket = 'credit' | 'reserve' | 'consume'

export type ConsumeBasis = 'actual' | 'scheduled'
export type ChargePolicy = 'none' | 'full'

export type BalancePolicy = {
  consume_basis: ConsumeBasis
  absence_charge: ChargePolicy
  late_cancel_charge: ChargePolicy
  cancel_notice_hours: number | null
}

export type BalanceRow = {
  contracted: number
  reserved: number
  realized: number
  consumed: number
  available: number
}

// `category: null` = saldo ainda sem categoria definida (matrícula conjunta, ex.: AB)
export type CategoryBalance = BalanceRow & { category: string | null }

export type Balance = BalanceRow & {
  has_package: boolean
  reference_minutes: number | null
  equivalent_lessons: number | null
  by_category: CategoryBalance[]
  policy: BalancePolicy | null
}

export type EnrollmentPackage = {
  id: number
  kind: 'contract' | 'addition' | 'initial'
  category: string | null
  description: string
  minutes: number
  reference_minutes: number | null
  price_cents: number | null
  consume_basis: ConsumeBasis
  absence_charge: ChargePolicy
  late_cancel_charge: ChargePolicy
  cancel_notice_hours: number | null
  created_at: string
}

export type BalanceDetail = Balance & { packages: EnrollmentPackage[] }

export type CreditEntry = {
  id: number
  bucket: CreditBucket
  type: string
  type_label: string
  category: string | null
  minutes: number
  reason: string | null
  lesson_id: number | null
  package_id: number | null
  reverses_entry_id: number | null
  actor?: { id: number; name: string } | null
  occurred_at: string
}

export type BalanceWarning = { code: string; message: string }
