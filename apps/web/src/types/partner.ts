// Parceiro = auto escola externa em nome da qual um instrutor autônomo atende.
// Não é usuário: não tem conta nem acesso ao sistema.
export type Partner = {
  id: number
  name: string
  document: string | null
  email: string | null
  phone: string | null
}
