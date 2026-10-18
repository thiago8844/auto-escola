import type { FieldErrors, UseFormRegister } from 'react-hook-form'
import { Col, Row } from 'react-bootstrap'
import { FormField } from './FormField'

type WindowValues = { date: string; start_time: string; duration: string }

type WindowFieldsProps<T extends WindowValues> = {
  register: UseFormRegister<T>
  errors: FieldErrors<T>
  timeZone: string
}

// Data, horário e duração: digitados no fuso do espaço. Campos nativos (date/time) funcionam bem no celular.
export function WindowFields<T extends WindowValues>({ register, errors, timeZone }: WindowFieldsProps<T>) {
  const reg = register as unknown as UseFormRegister<WindowValues>
  const err = errors as FieldErrors<WindowValues>

  return (
    <>
      <Row>
        <Col xs={12} sm={6}>
          <FormField label="Data" type="date" error={err.date?.message} {...reg('date')} />
        </Col>
        <Col xs={6} sm={3}>
          <FormField label="Início" type="time" error={err.start_time?.message} {...reg('start_time')} />
        </Col>
        <Col xs={6} sm={3}>
          <FormField label="Duração (min)" inputMode="numeric" error={err.duration?.message} {...reg('duration')} />
        </Col>
      </Row>
      <p className="small text-secondary mb-3">Horário de {timeZone.replace('_', ' ')} (fuso do espaço). Duração máxima: 240 minutos.</p>
    </>
  )
}
