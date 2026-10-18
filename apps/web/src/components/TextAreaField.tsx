import type { ComponentProps } from 'react'
import { Form } from 'react-bootstrap'

type TextAreaFieldProps = Omit<ComponentProps<typeof Form.Control>, 'as' | 'isInvalid' | 'size' | 'rows'> & {
  label: string
  error?: string
}

export function TextAreaField({ label, error, id, name, ...textarea }: TextAreaFieldProps) {
  return (
    <Form.Group className="mb-3" controlId={id ?? name}>
      <Form.Label>{label}</Form.Label>
      <Form.Control as="textarea" rows={3} {...textarea} name={name} isInvalid={!!error} />
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
    </Form.Group>
  )
}
