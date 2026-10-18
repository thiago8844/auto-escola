import type { ComponentProps } from 'react'
import { TIMEZONES } from '../config/organization'
import { SelectField } from './SelectField'

type TimezoneFieldProps = Omit<ComponentProps<typeof SelectField>, 'children' | 'label'> & { current?: string }

// Fuso horário do espaço: define o "dia" da agenda e como todos os horários são exibidos
export function TimezoneField({ current, ...select }: TimezoneFieldProps) {
  // Se o espaço usa um fuso fora da lista (a API aceita qualquer IANA), ele continua selecionável
  const extra = current && !TIMEZONES.some((tz) => tz.value === current) ? current : null
  return (
    <SelectField label="Fuso horário" {...select}>
      {extra && <option value={extra}>{extra.replace('_', ' ')}</option>}
      {TIMEZONES.map((tz) => (
        <option key={tz.value} value={tz.value}>
          {tz.label}
        </option>
      ))}
    </SelectField>
  )
}
