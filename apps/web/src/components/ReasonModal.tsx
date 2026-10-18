import { zodResolver } from '@hookform/resolvers/zod'
import type { ReactNode } from 'react'
import { Alert, Button, Modal } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import type { ApiError } from '../api/errors'
import { formAlertMessage } from '../utils/applyFieldErrors'
import { FormField } from './FormField'
import { SubmitButton } from './SubmitButton'
import { TextAreaField } from './TextAreaField'

type ReasonModalProps = {
  title: string
  description?: ReactNode
  label: string
  submitLabel: string
  // Campo curto de uma linha (ex.: referência) em vez de área de texto
  singleLine?: boolean
  minLength?: number
  pending: boolean
  error: ApiError | null
  onSubmit: (value: string) => void
  onClose: () => void
}

// Pede um texto obrigatório (motivo ou referência) antes de uma ação que precisa ficar registrada
export function ReasonModal({ title, description, label, submitLabel, singleLine, minLength = 3, pending, error, onSubmit, onClose }: ReasonModalProps) {
  const schema = z.object({ value: z.string().trim().min(minLength, `Informe ao menos ${minLength} caracteres.`).max(255, 'Máximo de 255 caracteres.') })
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ value: string }>({ resolver: zodResolver(schema), defaultValues: { value: '' } })

  const submit = handleSubmit((values) => onSubmit(values.value))
  const alertMessage = formAlertMessage(error)

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          {title}
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={submit} noValidate>
        <Modal.Body>
          {description && <div className="mb-3">{description}</div>}
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}
          {singleLine ? <FormField label={label} error={errors.value?.message} {...register('value')} /> : <TextAreaField label={label} error={errors.value?.message} {...register('value')} />}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <SubmitButton loading={pending}>{submitLabel}</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
