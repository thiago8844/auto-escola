import { Spinner } from 'react-bootstrap'

export function FullPageSpinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center">
      <Spinner animation="border" role="status" variant="primary">
        <span className="visually-hidden">{label}</span>
      </Spinner>
    </div>
  )
}
