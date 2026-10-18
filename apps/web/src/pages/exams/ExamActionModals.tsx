import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Col, Modal, Row } from 'react-bootstrap'
import { useForm, useWatch } from 'react-hook-form'
import { FormField } from '../../components/FormField'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { WindowFields } from '../../components/WindowFields'
import { EXAM_STATUS } from '../../config/domain'
import { useExamResult, useRescheduleExam, useUpdateExam } from '../../hooks/useExams'
import { useInstructors } from '../../hooks/useInstructors'
import { useVehicles } from '../../hooks/useVehicles'
import {
  examEditSchema,
  examRescheduleSchema,
  examResultSchema,
  type ExamEditInput,
  type ExamRescheduleInput,
  type ExamResultInput,
} from '../../schemas/exam'
import type { Exam } from '../../types/exam'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { isoToZonedParts, zonedTimeToIso } from '../../utils/timezone'

type Common = { organizationId: number; timezone: string; exam: Exam; onClose: () => void }

// Remarcar mantém a tentativa; a data, o local e os responsáveis anteriores ficam no histórico
export function RescheduleExamModal({ organizationId, timezone, exam, onClose }: Common) {
  const reschedule = useRescheduleExam(organizationId, exam.id)
  const instructors = useInstructors(organizationId, { page: 1, all: true, active: true })
  const vehicles = useVehicles(organizationId, { page: 1, all: true, status: 'active' })
  const start = isoToZonedParts(exam.scheduled_at, timezone)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ExamRescheduleInput>({
    resolver: zodResolver(examRescheduleSchema),
    defaultValues: {
      date: start.date,
      start_time: start.time,
      duration: String(exam.duration_minutes),
      location: exam.location ?? '',
      instructor_id: exam.instructor ? String(exam.instructor.id) : '',
      vehicle_id: exam.vehicle ? String(exam.vehicle.id) : '',
      reason: '',
    },
  })

  const onSubmit = handleSubmit((values) =>
    reschedule.mutate(
      {
        scheduled_at: zonedTimeToIso(values.date, values.start_time, timezone),
        duration_minutes: Number(values.duration),
        location: values.location || null,
        reason: values.reason,
        instructor_id: values.instructor_id ? Number(values.instructor_id) : null,
        vehicle_id: values.vehicle_id ? Number(values.vehicle_id) : null,
      },
      { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) },
    ),
  )
  const alertMessage = formAlertMessage(reschedule.error)

  return (
    <Modal show onHide={onClose} centered size="lg" fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Remarcar exame
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          {alertMessage && (
            <Alert variant="danger" role="alert">
              <i className="bi bi-calendar-x me-2" aria-hidden="true" />
              {alertMessage}
            </Alert>
          )}
          <WindowFields register={register} errors={errors} timeZone={timezone} />
          <FormField label="Local" error={errors.location?.message} {...register('location')} />
          <Row>
            <Col sm={6}>
              <SelectField label="Instrutor" error={errors.instructor_id?.message} {...register('instructor_id')}>
                <option value="">Sem instrutor</option>
                {instructors.data?.data.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.full_name}
                  </option>
                ))}
              </SelectField>
            </Col>
            <Col sm={6}>
              <SelectField label="Veículo" error={errors.vehicle_id?.message} {...register('vehicle_id')}>
                <option value="">Sem veículo</option>
                {vehicles.data?.data
                  .filter((v) => v.category === exam.category)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} · {v.model}
                    </option>
                  ))}
              </SelectField>
            </Col>
          </Row>
          <TextAreaField label="Motivo da remarcação" error={errors.reason?.message} {...register('reason')} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={reschedule.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={reschedule.isPending}>Remarcar</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

const RESULT_HELP: Record<string, string> = {
  approved: 'Registra a aprovação nesta categoria. Não altera as outras categorias do processo.',
  failed: 'Registra a reprovação. A tentativa fica no histórico e uma nova pode ser agendada.',
  absent: 'O aluno não compareceu. Ausência não é reprovação.',
  incomplete: 'O exame começou e não foi concluído (ex.: interrompido).',
  cancelled: 'O exame não vai acontecer. A tentativa permanece no histórico como cancelada.',
}

// Resultado (ou cancelamento) de uma tentativa agendada. Com `correction`, corrige um resultado já lançado.
export function ExamResultModal({ organizationId, exam, correction, onClose }: Omit<Common, 'timezone'> & { correction: boolean }) {
  const record = useExamResult(organizationId, exam.id, correction)
  const options = (correction ? ['approved', 'failed', 'absent', 'incomplete'] : ['approved', 'failed', 'absent', 'incomplete', 'cancelled']).filter((s) => s !== exam.status)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ExamResultInput>({ resolver: zodResolver(examResultSchema), defaultValues: { status: options[0] as ExamResultInput['status'], reason: '' } })
  const status = useWatch({ control, name: 'status' })
  const reasonRequired = correction || ['absent', 'incomplete', 'cancelled'].includes(status)

  const onSubmit = handleSubmit((values) => {
    if (reasonRequired && values.reason.length < 3) {
      setError('reason', { type: 'manual', message: 'Informe o motivo.' })
      return
    }
    record.mutate({ status: values.status, reason: values.reason || null }, { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) })
  })
  const alertMessage = formAlertMessage(record.error)

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          {correction ? 'Corrigir resultado' : 'Registrar resultado'}
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          {correction && (
            <Alert variant="warning" className="small">
              O resultado atual ({EXAM_STATUS[exam.status].label}) continua na linha do tempo, com autor, data e motivo da correção.
            </Alert>
          )}
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}
          <SelectField label="Resultado" error={errors.status?.message} {...register('status')}>
            {options.map((s) => (
              <option key={s} value={s}>
                {EXAM_STATUS[s as keyof typeof EXAM_STATUS].label}
              </option>
            ))}
          </SelectField>
          <p className="small text-secondary">{RESULT_HELP[status]}</p>
          <TextAreaField label={reasonRequired ? 'Motivo' : 'Observação (opcional)'} error={errors.reason?.message} {...register('reason')} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={record.isPending}>
            Voltar
          </Button>
          <SubmitButton loading={record.isPending}>{correction ? 'Corrigir' : 'Registrar'}</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}

export function EditExamModal({ organizationId, exam, onClose }: Omit<Common, 'timezone'>) {
  const update = useUpdateExam(organizationId, exam.id)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ExamEditInput>({
    resolver: zodResolver(examEditSchema),
    defaultValues: { protocol: exam.protocol ?? '', location: exam.location ?? '', notes: exam.notes ?? '' },
  })
  const onSubmit = handleSubmit((values) =>
    update.mutate(
      { protocol: values.protocol || null, location: values.location || null, notes: values.notes || null },
      { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) },
    ),
  )
  const alertMessage = formAlertMessage(update.error)

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Editar dados do exame
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          {alertMessage && (
            <Alert variant="danger" role="alert">
              {alertMessage}
            </Alert>
          )}
          <FormField label="Local" error={errors.location?.message} {...register('location')} />
          <FormField label="Protocolo" error={errors.protocol?.message} {...register('protocol')} />
          <TextAreaField label="Observações" error={errors.notes?.message} {...register('notes')} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={update.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={update.isPending}>Salvar</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
