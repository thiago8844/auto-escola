import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Alert, Button, Col, Form, Modal, Row } from 'react-bootstrap'
import { useForm, useWatch } from 'react-hook-form'
import { AffectedModal } from '../../components/AffectedModal'
import { CurrencyField } from '../../components/CurrencyField'
import { FormField } from '../../components/FormField'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { useCompleteMaintenance, useCreateMaintenance } from '../../hooks/useAvailability'
import { useVehicles } from '../../hooks/useVehicles'
import { completeMaintenanceSchema, maintenanceSchema, type CompleteMaintenanceInput, type MaintenanceInput } from '../../schemas/availability'
import type { Commitment, Maintenance } from '../../types/availability'
import type { Organization } from '../../types/organization'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { todayInTimeZone, zonedTimeToIso } from '../../utils/timezone'

const SERVICE_TYPES = ['Revisão', 'Troca de óleo', 'Pneus', 'Freios', 'Embreagem', 'Elétrica', 'Funilaria', 'Vistoria']

type NewMaintenanceModalProps = { organization: Organization; vehicleId?: number; onClose: () => void }

// Registra a manutenção e, se marcado, já bloqueia a agenda do veículo pelo período informado
export function NewMaintenanceModal({ organization, vehicleId, onClose }: NewMaintenanceModalProps) {
  const create = useCreateMaintenance(organization.id)
  const vehicles = useVehicles(organization.id, { page: 1, all: true })
  const [affected, setAffected] = useState<Commitment[] | null>(null)
  const today = todayInTimeZone(organization.timezone)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<MaintenanceInput>({
    resolver: zodResolver(maintenanceSchema),
    defaultValues: {
      vehicle_id: vehicleId ? String(vehicleId) : '',
      type: '',
      scheduled_on: today,
      provider: '',
      odometer_km: '',
      estimated_cost: '',
      notes: '',
      block_agenda: true,
      block_start_time: '08:00',
      block_end_date: today,
      block_end_time: '18:00',
    },
  })
  const blockAgenda = useWatch({ control, name: 'block_agenda' })

  const onSubmit = handleSubmit((values) =>
    create.mutate(
      {
        input: values,
        block: values.block_agenda
          ? {
              starts_at: zonedTimeToIso(values.scheduled_on, values.block_start_time, organization.timezone),
              ends_at: zonedTimeToIso(values.block_end_date, values.block_end_time, organization.timezone),
            }
          : null,
      },
      {
        onSuccess: (data) => (data.affected.length > 0 ? setAffected(data.affected) : onClose()),
        onError: (error) => applyFieldErrors(error, setError),
      },
    ),
  )
  const alertMessage = formAlertMessage(create.error)

  if (affected) {
    return (
      <AffectedModal
        organizationId={organization.id}
        timezone={organization.timezone}
        title="Manutenção registrada"
        summary="O veículo está bloqueado na agenda durante o serviço."
        commitments={affected}
        onClose={onClose}
      />
    )
  }

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Registrar manutenção
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}
          {!vehicleId && (
            <SelectField label="Veículo" error={errors.vehicle_id?.message} {...register('vehicle_id')}>
              <option value="">Escolha o veículo</option>
              {vehicles.data?.data.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} · {v.model}
                </option>
              ))}
            </SelectField>
          )}
          <FormField label="Serviço" list="maintenance-types" autoComplete="off" error={errors.type?.message} {...register('type')} />
          <datalist id="maintenance-types">
            {SERVICE_TYPES.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
          <Row>
            <Col sm={6}>
              <FormField label="Data do serviço" type="date" error={errors.scheduled_on?.message} {...register('scheduled_on')} />
            </Col>
            <Col sm={6}>
              <FormField label="Oficina ou fornecedor (opcional)" error={errors.provider?.message} {...register('provider')} />
            </Col>
            <Col sm={6}>
              <FormField label="Quilometragem (opcional)" inputMode="numeric" error={errors.odometer_km?.message} {...register('odometer_km')} />
            </Col>
            <Col sm={6}>
              <CurrencyField control={control} name="estimated_cost" label="Custo estimado (opcional)" error={errors.estimated_cost?.message} />
            </Col>
          </Row>

          <Form.Check type="switch" id="maintenance-block" className="mb-2" label="Bloquear a agenda do veículo durante o serviço" {...register('block_agenda')} />
          {blockAgenda && (
            <Row>
              <Col xs={12}>
                <p className="small text-secondary mb-2">Começa no dia do serviço e fica parado até:</p>
              </Col>
              <Col xs={5}>
                <FormField label="A partir das" type="time" error={errors.block_start_time?.message} {...register('block_start_time')} />
              </Col>
              <Col xs={7}>
                <FormField label="Volta no dia" type="date" error={errors.block_end_date?.message} {...register('block_end_date')} />
              </Col>
              <Col xs={5}>
                <FormField label="às" type="time" error={errors.block_end_time?.message} {...register('block_end_time')} />
              </Col>
            </Row>
          )}
          <TextAreaField label="Observações (opcional)" error={errors.notes?.message} {...register('notes')} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={create.isPending}>Registrar</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

type CompleteMaintenanceModalProps = { organization: Organization; maintenance: Maintenance; onClose: () => void }

// Conclui o serviço: grava o realizado, libera o veículo na agenda e programa a próxima revisão
export function CompleteMaintenanceModal({ organization, maintenance, onClose }: CompleteMaintenanceModalProps) {
  const complete = useCompleteMaintenance(organization.id, maintenance.id)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CompleteMaintenanceInput>({
    resolver: zodResolver(completeMaintenanceSchema),
    defaultValues: {
      performed_on: todayInTimeZone(organization.timezone),
      actual_cost: maintenance.estimated_cost_cents !== null ? String(maintenance.estimated_cost_cents / 100) : '',
      odometer_km: maintenance.odometer_km !== null ? String(maintenance.odometer_km) : '',
      next_due_date: '',
      next_due_km: '',
      notes: maintenance.notes ?? '',
    },
  })

  const onSubmit = handleSubmit((values) => complete.mutate(values, { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) }))
  const alertMessage = formAlertMessage(complete.error)

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Concluir: {maintenance.type}
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}
          {maintenance.block?.status === 'active' && <p className="small text-secondary">Ao concluir, o veículo é liberado na agenda. O bloqueio fica no histórico.</p>}
          <Row>
            <Col sm={6}>
              <FormField label="Data do serviço" type="date" error={errors.performed_on?.message} {...register('performed_on')} />
            </Col>
            <Col sm={6}>
              <CurrencyField control={control} name="actual_cost" label="Custo real" error={errors.actual_cost?.message} />
            </Col>
            <Col sm={6}>
              <FormField label="Quilometragem (opcional)" inputMode="numeric" error={errors.odometer_km?.message} {...register('odometer_km')} />
            </Col>
          </Row>
          <fieldset className="border rounded p-3 mb-3">
            <legend className="fs-6 float-none w-auto px-2 mb-0">Próxima revisão (opcional)</legend>
            <Row>
              <Col sm={6}>
                <FormField label="Por data" type="date" error={errors.next_due_date?.message} {...register('next_due_date')} />
              </Col>
              <Col sm={6}>
                <FormField label="Por quilometragem" inputMode="numeric" error={errors.next_due_km?.message} {...register('next_due_km')} />
              </Col>
            </Row>
            <p className="small text-secondary mb-0">O sistema avisa quando a data se aproxima ou a quilometragem informada chega perto. Não precisa de rastreador.</p>
          </fieldset>
          <TextAreaField label="Observações (opcional)" error={errors.notes?.message} {...register('notes')} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={complete.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={complete.isPending}>Concluir e liberar veículo</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
