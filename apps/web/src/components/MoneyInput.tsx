import { NumericFormat } from 'react-number-format'
import { BootstrapInput } from './BootstrapInput'

type Props = { id?: string; value: string; onValueChange: (value: string) => void; 'aria-label'?: string; size?: 'sm' | 'lg'; allowNegative?: boolean }
export function MoneyInput({ onValueChange, ...props }: Props) {
  return <NumericFormat {...props} customInput={BootstrapInput} inputMode="decimal" prefix="R$ " thousandSeparator="." decimalSeparator="," decimalScale={2} fixedDecimalScale allowNegative={props.allowNegative ?? false} valueIsNumericString onValueChange={(values) => onValueChange(values.value)} />
}
