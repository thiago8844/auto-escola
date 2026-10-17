import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import type { ApiError } from '../api/errors'

// Mostra os erros 422 da API embaixo de cada campo do formulário
export function applyFieldErrors<T extends FieldValues>(error: ApiError, setError: UseFormSetError<T>) {
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    setError(field as Path<T>, { type: 'server', message })
  }
}

// Mensagem para o alerta do formulário: some quando o erro já está nos campos
export function formAlertMessage(error: ApiError | null): string | null {
  if (!error) return null
  if (error.kind === 'validation' && Object.keys(error.fieldErrors).length > 0) return null
  return error.message
}
