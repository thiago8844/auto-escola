import { Button, Container } from 'react-bootstrap'
import type { ApiError } from '../api/errors'
import { API_URL } from '../config'

type ApiErrorScreenProps = {
  error: ApiError
  retrying: boolean
  onRetry: () => void
}

// Tela cheia para quando o app não consegue nem checar a sessão
export function ApiErrorScreen({ error, retrying, onRetry }: ApiErrorScreenProps) {
  const offline = error.kind === 'network'

  return (
    <Container as="main" className="min-vh-100 d-flex flex-column align-items-center justify-content-center text-center">
      <i className="bi bi-cloud-slash display-4 text-secondary" aria-hidden="true" />
      <h1 className="mt-3">{offline ? 'API indisponível' : 'Algo deu errado'}</h1>
      <p className="text-secondary" role="alert">
        {error.message}
      </p>
      {offline && (
        <p className="small text-secondary">
          Endereço configurado: <code>{API_URL || window.location.origin}</code>
        </p>
      )}
      <Button onClick={onRetry} disabled={retrying}>
        {retrying ? 'Tentando…' : 'Tentar novamente'}
      </Button>
    </Container>
  )
}
