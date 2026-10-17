import { Alert } from 'react-bootstrap'

export function ForbiddenNotice() {
  return (
    <Alert variant="warning" role="alert">
      <i className="bi bi-lock-fill me-2" aria-hidden="true" />
      Você não tem permissão para acessar esta página neste espaço.
    </Alert>
  )
}
