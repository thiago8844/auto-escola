import { Alert, Button } from 'react-bootstrap'
import type { ApiError } from '../api/errors'

type QueryErrorAlertProps = {
  error: ApiError
  onRetry?: () => void
}

export function QueryErrorAlert({ error, onRetry }: QueryErrorAlertProps) {
  return (
    <Alert variant="danger" role="alert" className="d-flex align-items-center justify-content-between gap-3">
      <span>{error.message}</span>
      {onRetry && (
        <Button variant="outline-danger" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </Alert>
  )
}
