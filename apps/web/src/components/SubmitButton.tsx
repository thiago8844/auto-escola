import type { ReactNode } from 'react'
import { Button, Spinner } from 'react-bootstrap'

type SubmitButtonProps = {
  loading: boolean
  children: ReactNode
}

export function SubmitButton({ loading, children }: SubmitButtonProps) {
  return (
    <Button type="submit" className="w-100" disabled={loading}>
      {loading && <Spinner animation="border" size="sm" className="me-2" aria-hidden="true" />}
      {children}
    </Button>
  )
}
