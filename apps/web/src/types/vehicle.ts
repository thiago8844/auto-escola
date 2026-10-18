export type VehicleCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'ACC'

export type VehicleStatus = 'active' | 'inactive'

export type Vehicle = {
  id: number
  plate: string
  brand: string | null
  model: string
  year: number | null
  category: VehicleCategory
  adapted: boolean
  adaptations: string | null
  crlv_expires_at: string | null
  status: VehicleStatus
  notes: string | null
  created_at: string
  updated_at?: string
}
