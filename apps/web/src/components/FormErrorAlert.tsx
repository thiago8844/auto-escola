import { Alert, Button } from 'react-bootstrap'
import type { ApiError } from '../api/errors'
import { formAlertMessage } from '../utils/applyFieldErrors'

type FormErrorAlertProps = { error: ApiError | null }

// Erro do formulário. Se outra pessoa alterou o registro (409), oferece recarregar sem perder o contexto.
export function FormErrorAlert({ error }: FormErrorAlertProps) {
  const message = formAlertMessage(error)
  if (!message) return null

  return (
    <Alert variant="danger" role="alert">
      {message}
      {error?.code === 'stale_record' && (
        <div className="mt-2">
          <Button size="sm" variant="outline-danger" onClick={() => window.location.reload()}>
            <i className="bi bi-arrow-clockwise me-2" aria-hidden="true" />
            Recarregar dados
          </Button>
        </div>
      )}
      {error?.kind === 'network' && <div className="mt-1 small">O que você digitou continua na tela. Ao tentar de novo, o envio não será duplicado.</div>}
    </Alert>
  )
}
