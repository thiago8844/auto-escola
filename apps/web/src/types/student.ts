// Instrutor atribuído só recebe nome e telefone: os demais campos podem faltar
export type Student = {
  id: number
  name: string
  phone: string | null
  cpf?: string | null
  email?: string | null
  birth_date?: string | null
  identity_number?: string | null
  identity_issuer?: string | null
  // Autoescola do aluno: parceira do espaço; nula = o próprio espaço
  partner_id?: number | null
  driving_school?: { kind: 'space' | 'partner'; id: number | null; name: string | null }
  created_at: string
  // Para detectar edição simultânea (enviado como expected_updated_at)
  updated_at?: string
}
