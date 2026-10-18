import { RecordLink } from '../../components/RecordLink'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Alert, Badge, Button, Card } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import { ReassignControls } from '../../components/CommitmentList'
import { FormField } from '../../components/FormField'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { SelectField } from '../../components/SelectField'
import { LessonStatusBadge } from '../../components/StatusBadges'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { LessonCommunicationCard } from '../../components/LessonCommunicationCard'
import { DOCUMENT_TYPE_LABELS, REGISTRY_STATUS } from '../../config/domain'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useEnrollment } from '../../hooks/useEnrollments'
import { useStudentDocuments } from '../../hooks/useStudentHistory'
import { useLesson, useUpdateLessonNotes, useUpdateLessonRegistry } from '../../hooks/useLessons'
import { lessonNotesSchema, registrySchema, type LessonNotesInput, type RegistryInput } from '../../schemas/lesson'
import type { Lesson } from '../../types/lesson'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { formatDayLabel, formatTime, isoToZonedParts } from '../../utils/timezone'
import { canOperate } from '../../utils/permissions'
import { RescheduleModal } from './RescheduleModal'
import { StatusModal } from './StatusModal'

export default function LessonDetailPage() {
  const { lessonId = '' } = useParams()
  const organization = useActiveOrganization()
  const query = useLesson(organization.id, lessonId)

  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(lesson) => <LessonDetail lesson={lesson} />}
    </QueryState>
  )
}

function LessonDetail({ lesson }: { lesson: Lesson }) {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const operate = canOperate(organization.role)
  const timeZone = organization.timezone
  const [modal, setModal] = useState<'reschedule' | 'status' | null>(null)

  const scheduled = lesson.status === 'scheduled'
  const completed = lesson.status === 'completed'
  // A liberação para a prática também bloqueia aqui, não só na API
  const enrollment = useEnrollment(organization.id, String(lesson.enrollment?.id ?? ''), lesson.enrollment !== undefined)
  const release = enrollment.data?.practice_release

  const day = isoToZonedParts(lesson.starts_at, timeZone).date

  return (
    <>
      <PageHeader
        title={lesson.enrollment?.student?.name ?? `Aula ${lesson.id}`}
        subtitle={
          <span className="text-capitalize">
            {formatDayLabel(day)} · {formatTime(lesson.starts_at, timeZone)}–{formatTime(lesson.ends_at, timeZone)}
          </span>
        }
        actions={
          <>
            {scheduled && operate && lesson.blockers && (
              <Badge bg={lesson.blockers.length === 0 ? 'success' : 'warning'} text={lesson.blockers.length === 0 ? undefined : 'dark'}>
                {lesson.blockers.length === 0 ? 'Pronta para realizar' : 'Pré-reserva'}
              </Badge>
            )}
            <LessonStatusBadge status={lesson.status} />
          </>
        }
      />

      {scheduled && operate && lesson.blockers && lesson.blockers.length > 0 && (
        <Alert variant="warning" className="mb-4">
          <div className="fw-semibold mb-1">
            <i className="bi bi-bookmark-fill me-2" aria-hidden="true" />
            Pré-reserva: ainda não pode ser realizada
          </div>
          <ul className="mb-2 ps-3">
            {lesson.blockers.map((blocker) => (
              <li key={blocker.code}>{blocker.message}</li>
            ))}
          </ul>
          <ReassignControls organizationId={organization.id} lessonId={lesson.id} showLink={false} />
        </Alert>
      )}

      {scheduled && (
        <div className="d-flex flex-wrap gap-2 mb-4">
          <Button onClick={() => setModal('status')}>Concluir, faltou ou cancelar</Button>
          <Button variant="outline-primary" onClick={() => setModal('reschedule')}>
            <i className="bi bi-calendar2-week me-2" aria-hidden="true" />
            Remarcar
          </Button>
          {!operate && <ReassignControls organizationId={organization.id} lessonId={lesson.id} showLink={false} canSwapInstructor={false} />}
        </div>
      )}

      <Card className="mb-4">
        <Card.Body>
          <dl className="row mb-0">
            <dt className="col-sm-4 col-md-3">Instrutor</dt>
            <dd className="col-sm-8 col-md-9">{lesson.instructor ? operate ? <RecordLink to={links.instructor(lesson.instructor.id)} returnLabel="Voltar à aula">{lesson.instructor.full_name}</RecordLink> : lesson.instructor.full_name : '—'}</dd>
            <dt className="col-sm-4 col-md-3">Veículo</dt>
            <dd className="col-sm-8 col-md-9">{lesson.vehicle ? <RecordLink to={links.vehicle(lesson.vehicle.id)} returnLabel="Voltar à aula">{lesson.vehicle.plate} · {lesson.vehicle.model} ({lesson.vehicle.category})</RecordLink> : 'Sem veículo'}</dd>
            <dt className="col-sm-4 col-md-3">Matrícula</dt>
            <dd className="col-sm-8 col-md-9">
              {lesson.enrollment ? <RecordLink to={links.enrollment(lesson.enrollment.id)} returnLabel="Voltar à aula">Categoria {lesson.enrollment.category}</RecordLink> : '—'}
            </dd>
            <dt className="col-sm-4 col-md-3">Duração agendada</dt>
            <dd className="col-sm-8 col-md-9">{lesson.scheduled_minutes} min</dd>
            <dt className="col-sm-4 col-md-3">Duração real</dt>
            <dd className="col-sm-8 col-md-9">{lesson.actual_minutes ? `${lesson.actual_minutes} min` : '—'}</dd>
            {lesson.status_reason && (
              <>
                <dt className="col-sm-4 col-md-3">Motivo</dt>
                <dd className="col-sm-8 col-md-9 text-break">{lesson.status_reason}</dd>
              </>
            )}
            <dt className="col-sm-4 col-md-3">Fuso do espaço</dt>
            <dd className="col-sm-8 col-md-9 mb-0">{timeZone.replace('_', ' ')}</dd>
          </dl>
        </Card.Body>
      </Card>

      {operate && <LessonCommunicationCard organizationId={organization.id} lesson={lesson} />}

      <NotesForm key={`${lesson.notes}-${lesson.evolution}-${lesson.actual_minutes}`} lesson={lesson} completed={completed} />

      {operate && <RegistryForm key={`${lesson.registry.status}-${lesson.registry.reference}-${lesson.registry.document_id}`} lesson={lesson} completed={completed} />}

      {modal === 'reschedule' && <RescheduleModal organizationId={organization.id} timeZone={timeZone} lesson={lesson} onClose={() => setModal(null)} />}
      {modal === 'status' && <StatusModal organizationId={organization.id} lesson={lesson} release={release} balance={enrollment.data?.balance} onClose={() => setModal(null)} />}
    </>
  )
}

function NotesForm({ lesson, completed }: { lesson: Lesson; completed: boolean }) {
  const organization = useActiveOrganization()
  const update = useUpdateLessonNotes(organization.id, String(lesson.id), completed)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LessonNotesInput>({
    resolver: zodResolver(lessonNotesSchema),
    defaultValues: { notes: lesson.notes ?? '', evolution: lesson.evolution ?? '', actual_minutes: lesson.actual_minutes ? String(lesson.actual_minutes) : '' },
  })
  const onSubmit = handleSubmit((values) => update.mutate(values, { onError: (error) => applyFieldErrors(error, setError) }))
  const alertMessage = formAlertMessage(update.error)

  return (
    <Card className="mb-4">
      <Card.Body>
        <Card.Title as="h2" className="h5">
          Observações e evolução
        </Card.Title>
        {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}
        <form onSubmit={onSubmit} noValidate className="form-narrow">
          <TextAreaField label="Observações" error={errors.notes?.message} {...register('notes')} />
          {completed ? (
            <>
              <TextAreaField label="Evolução do aluno" error={errors.evolution?.message} {...register('evolution')} />
              <FormField label="Duração real (min)" inputMode="numeric" error={errors.actual_minutes?.message} {...register('actual_minutes')} />
            </>
          ) : (
            <p className="small text-secondary">A evolução e a duração real ficam disponíveis depois que a aula for realizada.</p>
          )}
          <SubmitButton loading={update.isPending}>Salvar</SubmitButton>
        </form>
      </Card.Body>
    </Card>
  )
}

// Registro do lançamento oficial (feito fora do sistema): separado do status da aula, só da equipe
function RegistryForm({ lesson, completed }: { lesson: Lesson; completed: boolean }) {
  const organization = useActiveOrganization()
  const update = useUpdateLessonRegistry(organization.id, String(lesson.id))
  // Documentos do aluno que podem comprovar o lançamento oficial (a equipe é quem vê esta seção)
  const documents = useStudentDocuments(organization.id, String(lesson.enrollment?.student?.id ?? ''), lesson.enrollment?.student !== undefined)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegistryInput>({
    resolver: zodResolver(registrySchema),
    defaultValues: {
      registry_status: lesson.registry.status,
      registry_reference: lesson.registry.reference ?? '',
      registry_document_id: lesson.registry.document_id ? String(lesson.registry.document_id) : '',
    },
  })
  const onSubmit = handleSubmit((values) => update.mutate(values, { onError: (error) => applyFieldErrors(error, setError) }))
  const alertMessage = formAlertMessage(update.error)
  const current = REGISTRY_STATUS[lesson.registry.status]

  return (
    <Card className="mb-4">
      <Card.Body>
        <Card.Title as="h2" className="h5 d-flex align-items-center gap-2">
          Registro oficial <Badge bg={current.bg}>{current.label}</Badge>
        </Card.Title>
        <p className="small text-secondary">É o lançamento da aula no sistema oficial, feito fora daqui. Concluir a aula não preenche este registro.</p>
        {!completed && <Alert variant="info">O registro oficial só pode ser informado depois que a aula for realizada.</Alert>}
        {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}
        <form onSubmit={onSubmit} noValidate className="form-narrow">
          <fieldset disabled={!completed}>
            <SelectField label="Situação do registro" error={errors.registry_status?.message} {...register('registry_status')}>
              {Object.entries(REGISTRY_STATUS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <FormField label="Protocolo ou referência" error={errors.registry_reference?.message} {...register('registry_reference')} />
            <SelectField label="Documento de comprovação (opcional)" error={errors.registry_document_id?.message} {...register('registry_document_id')}>
              <option value="">Nenhum</option>
              {documents.data?.data
                .filter((doc) => doc.status !== 'replaced' || doc.id === lesson.registry.document_id)
                .map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {DOCUMENT_TYPE_LABELS[doc.type]} · {doc.original_name}
                  </option>
                ))}
            </SelectField>
            {documents.error && <p className="small text-danger">Não foi possível carregar os documentos: {documents.error.message}</p>}
            <SubmitButton loading={update.isPending}>Salvar registro</SubmitButton>
          </fieldset>
        </form>
      </Card.Body>
    </Card>
  )
}
