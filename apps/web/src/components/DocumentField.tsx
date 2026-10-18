import { Form } from 'react-bootstrap'
import { useController, type Control, type FieldValues, type Path } from 'react-hook-form'
import { NumberFormatBase } from 'react-number-format'
import { formatDocument, onlyDigits } from '../utils/formatDocument'
import { BootstrapInput } from './BootstrapInput'

type DocumentFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: Path<T>
  label: string
  error?: string
}

// CPF/CNPJ com máscara. O valor do formulário guarda só os dígitos (é o que a API grava).
export function DocumentField<T extends FieldValues>({ control, name, label, error }: DocumentFieldProps<T>) {
  const { field } = useController({ control, name })

  return (
    <Form.Group className="mb-3" controlId={name}>
      <Form.Label>{label}</Form.Label>
      <NumberFormatBase
        customInput={BootstrapInput}
        inputMode="numeric"
        autoComplete="off"
        isInvalid={!!error}
        name={field.name}
        getInputRef={field.ref}
        value={field.value ?? ''}
        valueIsNumericString
        format={formatDocument}
        removeFormatting={onlyDigits}
        onValueChange={(values) => field.onChange(values.value)}
        onBlur={field.onBlur}
      />
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
    </Form.Group>
  )
}
