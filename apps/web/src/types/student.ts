// Instrutor atribuído só recebe nome e telefone: os demais campos podem faltar
export type Student = {
  id: number
  name: string
  phone: string | null
  cpf?: string | null
  email?: string | null
  birth_date?: string | null
  created_at: string
}
