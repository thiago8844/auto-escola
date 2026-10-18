import type { ComponentProps } from 'react'
import { Form } from 'react-bootstrap'

type SelectFieldProps = Omit<ComponentProps<typeof Form.Select>, 'isInvalid' | 'size'> & {
  label: string
  error?: string
}

// Select com rótulo e erro. Funciona direto com {...register('campo')}.
export function SelectField({ label, error, id, name, children, ...select }: SelectFieldProps) {
  return (
    <Form.Group className="mb-3" controlId={id ?? name}>
      <Form.Label>{label}</Form.Label>
      <Form.Select {...select} name={name} isInvalid={!!error}>
        {children}
      </Form.Select>
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
    </Form.Group>
  )
}
