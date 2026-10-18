import { useEffect, useRef } from 'react'
import { Alert } from 'react-bootstrap'

export function FormErrorMessage({ message }: { message: string | null }) {
  const target = useRef<HTMLDivElement>(null)
  useEffect(() => { if (message) target.current?.focus() }, [message])
  return message ? <div ref={target} tabIndex={-1}><Alert variant="danger" role="alert">{message}</Alert></div> : null
}
