import type { ComponentProps } from 'react'
import { Form } from 'react-bootstrap'

type FormFieldProps = Omit<ComponentProps<typeof Form.Control>, 'isInvalid' | 'size'> & {
  label: string
  error?: string
  hint?: string
}

// Campo de formulário com rótulo e erro. Funciona direto com {...register('campo')}.
export function FormField({ label, error, hint, id, name, ...input }: FormFieldProps) {
  const fieldId = id ?? name
  const hintId = hint ? `${fieldId}-hint` : undefined

  return (
    <Form.Group className="mb-3" controlId={fieldId}>
      <Form.Label>{label}</Form.Label>
      <Form.Control {...input} name={name} isInvalid={!!error} aria-describedby={hintId} />
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
      {hint && (
        <Form.Text id={hintId} muted>
          {hint}
        </Form.Text>
      )}
    </Form.Group>
  )
}
