// Formato devolvido por GET /auth/user (UserResource da API)
export type User = {
  id: number
  name: string
  email: string
  email_verified: boolean
  has_instructor_profile: boolean
}
