export type OrganizationType = 'cfc' | 'independent'

export type Role = 'owner' | 'admin' | 'staff' | 'instructor'

export type Organization = {
  id: number
  name: string
  type: OrganizationType
  document: string | null
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  timezone: string
  // Horário de atendimento do espaço; nulo = agenda livre, só os bloqueios restringem
  business_hours: Record<string, Array<{ start: string; end: string }>> | null
  // Papel do usuário logado neste espaço
  role: Role
  created_at: string
  updated_at?: string
}

export type Member = {
  // ID do usuário (é o que as rotas /members/{member} esperam)
  id: number
  name: string
  email: string
  role: Role
  joined_at: string
}

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export type Invitation = {
  id: number
  email: string
  role: Role
  instructor_id: number | null
  status: InvitationStatus
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  created_at: string
  organization?: { id: number; name: string }
}

export type Paginated<T> = {
  data: T[]
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}
