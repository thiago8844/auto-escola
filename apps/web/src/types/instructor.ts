import type { LicenseCategory } from './enrollment'

// Sem e-mail nem ID de conta: a API só informa se há conta vinculada
export type Instructor = {
  id: number
  full_name: string
  credential_number: string | null
  categories: LicenseCategory[]
  has_account: boolean
  // Vínculo com o espaço (não é a identidade do instrutor)
  active?: boolean
}
