import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Alert, Button, Col, Form, Modal, Row } from 'react-bootstrap'
import { useForm, useWatch } from 'react-hook-form'
import { FormField } from '../../components/FormField'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { AffectedModal } from '../../components/AffectedModal'
import { useCreateBlock, useImpactPreview } from '../../hooks/useAvailability'
import { useInstructors } from '../../hooks/useInstructors'
import { useMyInstructor } from '../../hooks/useMe'
import { useVehicles } from '../../hooks/useVehicles'
import { blockSchema, type BlockInput } from '../../schemas/availability'
import type { BlockKind, BlockResult } from '../../types/availability'
import type { Organization } from '../../types/organization'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { canOperate } from '../../utils/permissions'
import { todayInTimeZone, zonedTimeToIso } from '../../utils/timezone'

const KIND_OPTIONS: Array<{ value: BlockKind; label: string }> = [
  { value: 'maintenance', label: 'Manutenção' },
  { value: 'absence', label: 'Ausência' },
  { value: 'vacation', label: 'Férias' },
  { value: 'other', label: 'Indisponibilidade pontual' },
]

type BlockModalProps = {
  organization: Organization
  // Recurso já definido (vem do detalhe do veículo/instrutor); sem isso a pessoa escolhe
  vehicleId?: number
  instructorId?: number
  onClose: () => void
}

// Bloqueia a agenda de um veículo ou instrutor. Mostra, antes de salvar, quantos compromissos seriam afetados.
export function BlockModal({ organization, vehicleId, instructorId, onClose }: BlockModalProps) {
  const staff = canOperate(organization.role)
  const create = useCreateBlock(organization.id)
  const mine = useMyInstructor()
  const [result, setResult] = useState<BlockResult | null>(null)
  const today = todayInTimeZone(organization.timezone)

  // Quem não é da equipe só registra a própria indisponibilidade, que vale em todos os espaços
  const ownInstructorId = mine.data?.id
  const presetResource = vehicleId ? 'vehicle' : instructorId || !staff ? 'instructor' : 'vehicle'

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<BlockInput>({
    resolver: zodResolver(blockSchema),
    values: {
      resource_type: presetResource,
      vehicle_id: vehicleId ? String(vehicleId) : '',
      instructor_id: instructorId ? String(instructorId) : !staff && ownInstructorId ? String(ownInstructorId) : '',
      scope: staff ? 'organization' : 'personal',
      kind: vehicleId ? 'maintenance' : 'absence',
      start_date: today,
      start_time: '08:00',
      end_date: today,
      end_time: '18:00',
      reason: '',
    },
  })
  const [resourceType, vehicle, instructor, scope, startDate, startTime, endDate, endTime] = useWatch({
    control,
    name: ['resource_type', 'vehicle_id', 'instructor_id', 'scope', 'start_date', 'start_time', 'end_date', 'end_time'],
  })

  const vehicles = useVehicles(organization.id, { page: 1, all: true, status: 'active' })
  const instructors = useInstructors(organization.id, { page: 1, all: true, active: true })

  const startsAt = startDate && startTime ? zonedTimeToIso(startDate, startTime, organization.timezone) : null
  const endsAt = endDate && endTime ? zonedTimeToIso(endDate, endTime, organization.timezone) : null
  const preview = useImpactPreview(organization.id, {
    vehicleId: resourceType === 'vehicle' ? vehicle : undefined,
    instructorId: resourceType === 'instructor' ? instructor : undefined,
    startsAt,
    endsAt,
  })
  const isOwnInstructor = ownInstructorId !== undefined && instructor === String(ownInstructorId)

  const onSubmit = handleSubmit((values) =>
    create.mutate(
      {
        resource_type: values.resource_type,
        vehicle_id: values.resource_type === 'vehicle' ? Number(values.vehicle_id) : undefined,
        instructor_id: values.resource_type === 'instructor' ? Number(values.instructor_id) : undefined,
        scope: values.resource_type === 'instructor' ? values.scope : undefined,
        kind: values.kind,
        starts_at: zonedTimeToIso(values.start_date, values.start_time, organization.timezone),
        ends_at: zonedTimeToIso(values.end_date, values.end_time, organization.timezone),
        reason: values.reason,
      },
      {
        onSuccess: (data) => (data.affected.length > 0 || data.external_affected > 0 ? setResult(data) : onClose()),
        onError: (error) => applyFieldErrors(error, setError),
      },
    ),
  )
  const alertMessage = formAlertMessage(create.error)

  if (result) {
    return (
      <AffectedModal
        organizationId={organization.id}
        timezone={organization.timezone}
        title="Bloqueio registrado"
        summary="A agenda já está protegida: novas reservas nesse período serão recusadas."
        commitments={result.affected}
        externalCount={result.external_affected}
        onClose={onClose}
      />
    )
  }

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          {staff ? 'Bloquear horários' : 'Minha indisponibilidade'}
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}

          {staff && !vehicleId && !instructorId && (
            <SelectField label="O que será bloqueado" error={errors.resource_type?.message} {...register('resource_type')}>
              <option value="vehicle">Veículo</option>
              <option value="instructor">Instrutor</option>
            </SelectField>
          )}

          {resourceType === 'vehicle' && !vehicleId && (
            <SelectField label="Veículo" error={errors.vehicle_id?.message} {...register('vehicle_id')}>
              <option value="">Escolha o veículo</option>
              {vehicles.data?.data.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.plate} · {v.model}
                </option>
              ))}
            </SelectField>
          )}
          {resourceType === 'instructor' && staff && !instructorId && (
            <SelectField label="Instrutor" error={errors.instructor_id?.message} {...register('instructor_id')}>
              <option value="">Escolha o instrutor</option>
              {instructors.data?.data.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.full_name}
                </option>
              ))}
            </SelectField>
          )}

          <SelectField label="Motivo geral" error={errors.kind?.message} {...register('kind')}>
            {KIND_OPTIONS.filter((k) => resourceType === 'instructor' ? k.value !== 'maintenance' : k.value === 'maintenance' || k.value === 'other').map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </SelectField>

          <Row>
            <Col xs={7}>
              <FormField label="Início: dia" type="date" error={errors.start_date?.message} {...register('start_date')} />
            </Col>
            <Col xs={5}>
              <FormField label="Hora" type="time" error={errors.start_time?.message} {...register('start_time')} />
            </Col>
            <Col xs={7}>
              <FormField label="Fim: dia" type="date" error={errors.end_date?.message} {...register('end_date')} />
            </Col>
            <Col xs={5}>
              <FormField label="Hora" type="time" error={errors.end_time?.message} {...register('end_time')} />
            </Col>
          </Row>
          <p className="small text-secondary">Horário de {organization.timezone.replace('_', ' ')}.</p>

          <FormField label="Descrição" placeholder="Ex.: revisão dos 40 mil km, férias, consulta" error={errors.reason?.message} {...register('reason')} />

          {resourceType === 'instructor' && staff && isOwnInstructor && (
            <Form.Check
              type="switch"
              id="block-personal"
              className="mb-3"
              label="Vale em todos os meus espaços (indisponibilidade pessoal)"
              checked={scope === 'personal'}
              onChange={(event) => setValue('scope', event.target.checked ? 'personal' : 'organization')}
            />
          )}
          {scope === 'personal' && (
            <p className="small text-secondary">Outros espaços verão apenas “instrutor indisponível” nesse horário, sem motivo nem detalhes.</p>
          )}

          {preview.data && preview.data.length > 0 && (
            <Alert variant="warning" className="small mb-0">
              <i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />
              {preview.data.length} {preview.data.length === 1 ? 'aula ou exame já agendado cai' : 'aulas ou exames já agendados caem'} nesse período. Nada será cancelado: você escolhe a providência depois de salvar.
            </Alert>
          )}
          {preview.data && preview.data.length === 0 && <p className="small text-success mb-0">Nenhum compromisso agendado nesse período.</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={create.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={create.isPending}>Bloquear</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
