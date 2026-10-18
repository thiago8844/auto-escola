import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { FormField } from '../../components/FormField'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { ISSUANCE_KIND_LABELS } from '../../config/domain'
import { useClosureCheck, useCloseProcess, useRegisterIssuance } from '../../hooks/useOutcome'
import { closeSchema, issuanceSchema, type CloseFormInput, type IssuanceFormInput } from '../../schemas/outcome'
import type { QualificationProcess } from '../../types/process'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'

export function IssuanceModal({ organizationId, process, onClose }: { organizationId: number; process: QualificationProcess; onClose: () => void }) {
  const issuance = process.outcome!.issuance
  const register_ = useRegisterIssuance(organizationId, String(process.id))
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<IssuanceFormInput>({
    resolver: zodResolver(issuanceSchema),
    defaultValues: {
      status: issuance.status === 'not_started' ? 'pending' : issuance.status,
      kind: issuance.kind ?? '',
      reference: issuance.reference ?? '',
      issued_at: issuance.issued_at ?? '',
      delivered_at: issuance.delivered_at ?? '',
      definitive_follow_up: issuance.definitive_follow_up,
      definitive_due_at: issuance.definitive_due_at ?? '',
      reason: '',
    },
  })
  const [status, followUp] = useWatch({ control, name: ['status', 'definitive_follow_up'] })

  const onSubmit = handleSubmit((values) =>
    register_.mutate(
      {
        status: values.status,
        kind: (values.kind || null) as 'ppd' | 'cnh' | null,
        reference: values.reference || null,
        issued_at: values.issued_at || null,
        delivered_at: values.status === 'delivered' ? values.delivered_at || null : null,
        definitive_follow_up: values.definitive_follow_up,
        definitive_due_at: values.definitive_due_at || null,
        reason: values.reason || null,
      },
      { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) },
    ),
  )
  const alertMessage = formAlertMessage(register_.error)

  return (
    <Modal show onHide={onClose} centered size="lg" fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Emissão do documento
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          <Alert variant="secondary" className="small">
            Acompanhamento interno: a emissão oficial é feita fora do sistema. Registre a referência para comprovar cada etapa. Voltar uma etapa exige motivo.
          </Alert>
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}
          <Row>
            <Col sm={6}>
              <SelectField label="Situação da emissão" error={errors.status?.message} {...register('status')}>
                <option value="pending">Emissão pendente</option>
                <option value="issued">Documento emitido</option>
                <option value="delivered">Entregue ao aluno</option>
              </SelectField>
            </Col>
            <Col sm={6}>
              <SelectField label="Modalidade do documento" error={errors.kind?.message} {...register('kind')}>
                <option value="">{status === 'pending' ? 'Ainda não definida' : 'Escolha'}</option>
                {Object.entries(ISSUANCE_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </Col>
          </Row>
          {status !== 'pending' && (
            <Row>
              <Col sm={6}>
                <FormField label="Data de emissão" type="date" error={errors.issued_at?.message} {...register('issued_at')} />
              </Col>
              <Col sm={6}>
                <FormField label="Referência da emissão" hint="Número do documento ou protocolo." error={errors.reference?.message} {...register('reference')} />
              </Col>
            </Row>
          )}
          {status === 'delivered' && <FormField label="Data da entrega" type="date" error={errors.delivered_at?.message} {...register('delivered_at')} />}

          <Controller
            control={control}
            name="definitive_follow_up"
            render={({ field }) => (
              <Form.Check
                id="definitive_follow_up"
                type="switch"
                className="mb-3"
                label="Acompanhar a futura definitiva como notificação"
                checked={field.value}
                onChange={(event) => field.onChange(event.target.checked)}
              />
            )}
          />
          {followUp && <FormField label="Prazo previsto (opcional)" type="date" hint="O prazo posterior não impede concluir o processo." error={errors.definitive_due_at?.message} {...register('definitive_due_at')} />}
          <TextAreaField label="Motivo (obrigatório ao voltar uma etapa)" error={errors.reason?.message} {...register('reason')} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={register_.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={register_.isPending}>Salvar</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

// Conclusão, encerramento ou desistência: mostra o que ficaria em aberto e exige decisão explícita
export function CloseProcessModal({ organizationId, process, onClose }: { organizationId: number; process: QualificationProcess; onClose: () => void }) {
  const check = useClosureCheck(organizationId, String(process.id), true)
  const close = useCloseProcess(organizationId, String(process.id))
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CloseFormInput>({ resolver: zodResolver(closeSchema), defaultValues: { kind: 'abandoned', reason: '', cancel_future: false, acknowledge_pending: false } })
  const kind = useWatch({ control, name: 'kind' })
  const data = check.data
  const futureCount = (data?.future_lessons ?? 0) + (data?.future_exams ?? 0)

  const onSubmit = handleSubmit((values) => {
    if (values.kind !== 'completed' && values.reason.length < 3) return setError('reason', { type: 'manual', message: 'Informe o motivo do encerramento.' })
    if (futureCount > 0 && !values.cancel_future) return setError('cancel_future', { type: 'manual', message: 'Confirme o cancelamento dos compromissos futuros.' })
    if ((data?.pending.length ?? 0) > 0 && !values.acknowledge_pending) return setError('acknowledge_pending', { type: 'manual', message: 'Confirme que está ciente das notificações.' })
    close.mutate(
      { kind: values.kind, reason: values.reason || null, cancel_future: values.cancel_future, acknowledge_pending: values.acknowledge_pending },
      { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) },
    )
  })
  const alertMessage = formAlertMessage(close.error)

  return (
    <Modal show onHide={onClose} centered size="lg" fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Concluir ou encerrar o processo
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          {check.isPending && <Spinner animation="border" size="sm" role="status" aria-label="Conferindo notificações" />}
          {check.error && <Alert variant="danger">{check.error.message}</Alert>}
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}

          {data && (
            <>
              <SelectField label="O que aconteceu?" error={errors.kind?.message} {...register('kind')}>
                <option value="completed" disabled={!data.can_complete}>
                  Processo concluído{data.can_complete ? '' : ' (requer categorias aprovadas/renunciadas e emissão registrada)'}
                </option>
                <option value="abandoned">Desistência do aluno</option>
                <option value="other">Outro encerramento</option>
              </SelectField>

              {futureCount > 0 && (
                <Alert variant="warning">
                  <p className="fw-semibold mb-1">
                    <i className="bi bi-calendar-x me-2" aria-hidden="true" />
                    Compromissos futuros: {data.future_lessons} aula(s) e {data.future_exams} exame(s) agendados
                  </p>
                  <Controller
                    control={control}
                    name="cancel_future"
                    render={({ field }) => (
                      <Form.Check
                        id="cancel_future"
                        type="checkbox"
                        label="Cancelar esses compromissos (as reservas de saldo são liberadas)"
                        checked={field.value}
                        isInvalid={!!errors.cancel_future}
                        feedback={errors.cancel_future?.message}
                        feedbackType="invalid"
                        onChange={(event) => field.onChange(event.target.checked)}
                      />
                    )}
                  />
                </Alert>
              )}

              {data.pending.length > 0 && (
                <Alert variant="info">
                  <p className="fw-semibold mb-1">
                    <i className="bi bi-info-circle me-2" aria-hidden="true" />
                    Ficarão em aberto
                  </p>
                  <ul className="mb-2">
                    {data.pending.map((item) => (
                      <li key={item.code}>{item.message}</li>
                    ))}
                  </ul>
                  <Controller
                    control={control}
                    name="acknowledge_pending"
                    render={({ field }) => (
                      <Form.Check
                        id="acknowledge_pending"
                        type="checkbox"
                        label="Estou ciente e quero encerrar mesmo assim"
                        checked={field.value}
                        isInvalid={!!errors.acknowledge_pending}
                        feedback={errors.acknowledge_pending?.message}
                        feedbackType="invalid"
                        onChange={(event) => field.onChange(event.target.checked)}
                      />
                    )}
                  />
                </Alert>
              )}

              <TextAreaField label={kind === 'completed' ? 'Observação (opcional)' : 'Motivo'} error={errors.reason?.message} {...register('reason')} />
              <p className="small text-secondary mb-0">O histórico, os exames e o extrato de saldo permanecem. Só proprietário e gestor podem reabrir depois.</p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={close.isPending}>
            Voltar
          </Button>
          <SubmitButton loading={close.isPending}>{kind === 'completed' ? 'Concluir processo' : 'Encerrar processo'}</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
