import { Form } from 'react-bootstrap'
import { useController, type Control, type FieldValues, type Path } from 'react-hook-form'
import { NumericFormat } from 'react-number-format'
import { BootstrapInput } from './BootstrapInput'

type CurrencyFieldProps<T extends FieldValues> = {
  control: Control<T>
  name: Path<T>
  label: string
  error?: string
}

// Valor em reais com máscara (R$ 1.250,00). O formulário guarda o número como texto ("1250.5").
export function CurrencyField<T extends FieldValues>({ control, name, label, error }: CurrencyFieldProps<T>) {
  const { field } = useController({ control, name })

  return (
    <Form.Group className="mb-3" controlId={name}>
      <Form.Label>{label}</Form.Label>
      <NumericFormat
        customInput={BootstrapInput}
        inputMode="decimal"
        autoComplete="off"
        isInvalid={!!error}
        name={field.name}
        getInputRef={field.ref}
        value={field.value ?? ''}
        valueIsNumericString
        prefix="R$ "
        thousandSeparator="."
        decimalSeparator=","
        decimalScale={2}
        fixedDecimalScale
        allowNegative={false}
        onValueChange={(values) => field.onChange(values.value)}
        onBlur={field.onBlur}
      />
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
    </Form.Group>
  )
}
