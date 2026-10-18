import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Col, Modal, Row } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { FormField } from '../../components/FormField'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { useAdjustBalance, useReverseEntry } from '../../hooks/useBalance'
import { adjustSchema, reasonSchema, type AdjustFormInput, type ReasonFormInput } from '../../schemas/balance'
import type { CreditEntry } from '../../types/balance'
import type { Enrollment } from '../../types/enrollment'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { formatMinutes } from '../../utils/formatMinutes'

// Ajuste manual: sempre com motivo; o extrato anterior nunca é alterado
export function AdjustBalanceModal({ organizationId, enrollment, onClose }: { organizationId: number; enrollment: Enrollment; onClose: () => void }) {
  const adjust = useAdjustBalance(organizationId, enrollment.id)
  const components = enrollment.category === 'AB' ? ['A', 'B'] : []
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<AdjustFormInput>({ resolver: zodResolver(adjustSchema), defaultValues: { direction: 'add', minutes: '', category: '', reason: '' } })

  const onSubmit = handleSubmit((values) =>
    adjust.mutate(
      { minutes: (values.direction === 'add' ? 1 : -1) * Number(values.minutes), category: values.category || null, reason: values.reason },
      { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) },
    ),
  )
  const alertMessage = formAlertMessage(adjust.error)

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Ajustar saldo
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          <Alert variant="secondary" className="small">
            O ajuste entra no extrato com seu nome, a data e o motivo. Nada é apagado ou editado: para desfazer um ajuste, estorne-o.
          </Alert>
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}
          <Row>
            <Col sm={6}>
              <SelectField label="Operação" error={errors.direction?.message} {...register('direction')}>
                <option value="add">Acrescentar minutos</option>
                <option value="remove">Retirar minutos</option>
              </SelectField>
            </Col>
            <Col sm={6}>
              <FormField label="Minutos" inputMode="numeric" error={errors.minutes?.message} {...register('minutes')} />
            </Col>
          </Row>
          {components.length > 0 && (
            <SelectField label="Categoria" error={errors.category?.message} {...register('category')}>
              <option value="">Saldo sem categoria</option>
              {components.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
          )}
          <TextAreaField label="Motivo" error={errors.reason?.message} {...register('reason')} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={adjust.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={adjust.isPending}>Registrar ajuste</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

// Estorno: cria um movimento compensatório e preserva o original
export function ReverseEntryModal({ organizationId, enrollmentId, entry, onClose }: { organizationId: number; enrollmentId: number; entry: CreditEntry; onClose: () => void }) {
  const reverse = useReverseEntry(organizationId, enrollmentId)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ReasonFormInput>({ resolver: zodResolver(reasonSchema), defaultValues: { reason: '' } })

  const onSubmit = handleSubmit((values) =>
    reverse.mutate({ entryId: entry.id, reason: values.reason }, { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) }),
  )
  const alertMessage = formAlertMessage(reverse.error)

  return (
    <Modal show onHide={onClose} centered>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Estornar movimento
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          <p>
            <strong>{entry.type_label}</strong> de {formatMinutes(Math.abs(entry.minutes))}
            {entry.reason ? ` — ${entry.reason}` : ''}. Um movimento contrário será criado; o original continua no extrato.
          </p>
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}
          <TextAreaField label="Motivo do estorno" error={errors.reason?.message} {...register('reason')} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={reverse.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={reverse.isPending}>Estornar</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
