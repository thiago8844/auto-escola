import type { ComponentProps } from 'react'
import { Form } from 'react-bootstrap'

// Adaptador de tipos: o react-number-format (customInput) espera um componente de <input> simples
export function BootstrapInput(props: Omit<ComponentProps<typeof Form.Control>, 'as'>) {
  return <Form.Control {...props} />
}
