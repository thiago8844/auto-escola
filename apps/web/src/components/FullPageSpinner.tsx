import { Spinner } from 'react-bootstrap'
import { Logo } from './Logo'

export function FullPageSpinner({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="min-vh-100 d-flex flex-column gap-4 align-items-center justify-content-center">
      <Logo variant="symbol" height={64} />
      <Spinner animation="border" role="status" variant="primary">
        <span className="visually-hidden">{label}</span>
      </Spinner>
    </div>
  )
}
