import type { Vehicle } from './vehicle'

export type BlockKind = 'maintenance' | 'absence' | 'vacation' | 'other'

export type BlockScope = 'organization' | 'personal'

export type AvailabilityBlock = {
  id: number
  resource_type: 'vehicle' | 'instructor'
  scope: BlockScope
  // Indisponibilidade pessoal criada em outro espaço: só a janela é visível
  external: boolean
  kind: BlockKind
  kind_label: string
  starts_at: string
  ends_at: string
  reason: string | null
  status: 'active' | 'released'
  released_at: string | null
  release_note: string | null
  maintenance_id: number | null
  vehicle?: { id: number; plate: string; model: string }
  instructor?: { id: number; full_name: string }
  created_by: { id: number; name: string } | null
  created_at: string
}

// Aula ou exame agendado afetado por um bloqueio, inativação ou vencimento
export type Commitment = {
  type: 'lesson' | 'exam'
  id: number
  starts_at: string
  ends_at: string
  student: string | null
  enrollment_id: number | null
  vehicle: { id: number; plate: string } | null
  instructor: { id: number; name: string } | null
  affected_by: Array<'vehicle' | 'instructor'>
  issues?: Array<'blocked' | 'crlv_expired' | 'inactive'>
}

export type BlockResult = { block: AvailabilityBlock; affected: Commitment[]; external_affected: number }

export type MaintenanceStatus = 'scheduled' | 'done' | 'cancelled'

export type Maintenance = {
  id: number
  vehicle_id: number
  vehicle?: { id: number; plate: string; model: string }
  type: string
  status: MaintenanceStatus
  scheduled_on: string
  performed_on: string | null
  provider: string | null
  odometer_km: number | null
  estimated_cost_cents: number | null
  actual_cost_cents: number | null
  document_id: number | null
  next_due_date: string | null
  next_due_km: number | null
  notes: string | null
  // Referência única para a futura conta a pagar (financeiro)
  finance_ref: string
  block?: { id: number; starts_at: string; ends_at: string; status: 'active' | 'released' }
  created_at: string
}

export type MaintenanceDue = { state: 'due_soon' | 'overdue'; reasons: Array<'date' | 'km'>; maintenance: Maintenance }

export type VehicleDocument = {
  id: number
  type: string
  status: string
  version: number
  expires_at: string | null
  original_name: string
  created_at: string
}

export type VehicleOverview = {
  vehicle: Vehicle
  documents: VehicleDocument[]
  blocks: AvailabilityBlock[]
  maintenances: Maintenance[]
  maintenance_due: MaintenanceDue[]
  commitments: Commitment[]
  affected_count: number
}

// { "1": [{ start: "08:00", end: "12:00" }], ... } com 1 = segunda e 7 = domingo
export type WeeklyHours = Record<string, Array<{ start: string; end: string }>>

export type InstructorAvailability = {
  instructor: { id: number; full_name: string; active?: boolean }
  rule: { mode: 'free' | 'restricted'; business_hours: WeeklyHours | null; weekly_hours: WeeklyHours | null }
  blocks: AvailabilityBlock[]
  upcoming_count: number
  upcoming: Commitment[]
}
