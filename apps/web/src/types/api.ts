// Corpo de erro da API: { message, error?, errors? }. O campo `error` é um código estável.
export type ApiErrorBody = {
  message?: string
  error?: string
  errors?: Record<string, string[]>
}

export type MessageResponse = { message: string }
