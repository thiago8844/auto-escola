import { useState } from 'react'
import { Button, Col, Form, Modal, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AgendaControls } from '../../components/AgendaControls'
import { AgendaDays } from '../../components/AgendaDays'
import type { Column } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { LessonStatusBadge } from '../../components/StatusBadges'
import { organizationPaths } from '../../config/paths'
import { changeLessonStatus } from '../../api/lessons'
import { toApiError } from '../../api/errors'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useAgendaState } from '../../hooks/useAgendaState'
import { useEnrollment } from '../../hooks/useEnrollments'
import { useInstructors } from '../../hooks/useInstructors'
import { useAgenda, useInvalidateOrganization } from '../../hooks/useLessons'
import { useVehicles } from '../../hooks/useVehicles'
import type { LessonStatusInput } from '../../schemas/lesson'
import type { Lesson } from '../../types/lesson'
import { canOperate } from '../../utils/permissions'
import { formatTime } from '../../utils/timezone'
import { RescheduleModal } from './RescheduleModal'
import { StatusModal } from './StatusModal'

// Ação rápida: a aula é concluída sem evolução nem duração real; para detalhes, use o botão Concluir da própria aula
const COMPLETE_WITHOUT_DETAILS: LessonStatusInput = { status: 'completed', reason: '', actual_minutes: '', evolution: '', notes: '' }

type LessonAction = { lesson: Lesson; kind: 'status' | 'reschedule' }

export default function SchedulePage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const operate = canOperate(organization.role)
  const timeZone = organization.timezone
  const { searchParams, view, date, today, first, last, step, days, update } = useAgendaState(timeZone)
  const instructorId = searchParams.get('instrutor') ?? ''
  const vehicleId = searchParams.get('veiculo') ?? ''
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<number>>(new Set())
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number>>(new Set())
  const [action, setAction] = useState<LessonAction | null>(null)
  const [bulkOpen, setBulkOpen] = useState(false)

  const agenda = useAgenda(organization.id, { from: first, to: last, instructorId, vehicleId })
  // Filtro por instrutor é da equipe (a listagem de instrutores não é aberta ao instrutor)
  const instructors = useInstructors(organization.id, { page: 1, all: true }, operate)
  const vehicles = useVehicles(organization.id, { page: 1, all: true })

  const toggleExpanded = (lesson: Lesson) =>
    setExpandedIds((previous) => toggleId(previous, lesson.id))
  const toggleSelected = (lesson: Lesson) => setSelectedIds((previous) => toggleId(previous, lesson.id))

  const columns: Column<Lesson>[] = [
    {
      header: 'Horário',
      primary: true,
      cell: (lesson) => <span className="tabular-nums">{formatTime(lesson.starts_at, timeZone)}–{formatTime(lesson.ends_at, timeZone)}</span>,
    },
    { header: 'Aluno', cell: (lesson) => lesson.enrollment?.student?.name ?? '—' },
    { header: 'Instrutor', cell: (lesson) => lesson.instructor?.full_name ?? '—' },
    { header: 'Veículo', cell: (lesson) => (lesson.vehicle ? `${lesson.vehicle.plate} · ${lesson.vehicle.model}` : 'Sem veículo') },
    { header: 'Situação', cell: (lesson) => <LessonStatusBadge status={lesson.status} /> },
    {
      header: 'Ações',
      actions: true,
      cell: (lesson, { mobile }) => {
        const scheduled = lesson.status === 'scheduled'
        const expanded = expandedIds.has(lesson.id)
        return (
          <div className="d-inline-flex flex-wrap gap-1 justify-content-end">
            {scheduled && <LessonActionButton mobile={mobile} icon="bi-check2-square" label="Concluir, faltou ou cancelar" short="Concluir" onClick={() => setAction({ lesson, kind: 'status' })} />}
            {scheduled && <LessonActionButton mobile={mobile} icon="bi-calendar2-week" label="Remarcar" short="Remarcar" onClick={() => setAction({ lesson, kind: 'reschedule' })} />}
            <LessonActionButton
              mobile={mobile}
              icon={expanded ? 'bi-chevron-up' : 'bi-chevron-down'}
              label={expanded ? 'Recolher aula' : 'Expandir aula'}
              short={expanded ? 'Recolher' : 'Detalhes'}
              expanded={expanded}
              onClick={() => toggleExpanded(lesson)}
            />
          </div>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Agenda"
        actions={
          <Link to={links.scheduleNew(`?data=${date}&instrutor=${instructorId}&veiculo=${vehicleId}`)} className="btn btn-primary">
            <i className="bi bi-plus-lg me-2" aria-hidden="true" />
            Agendar aula
          </Link>
        }
      />

      <AgendaControls view={view} date={date} step={step} onChange={update} />

      <Row className="g-2 mb-4">
        {operate && (
          <Col xs={12} sm={6} lg={4}>
            <Form.Select aria-label="Filtrar por instrutor" value={instructorId} onChange={(event) => update({ instrutor: event.target.value })}>
              <option value="">Todos os instrutores</option>
              {instructors.data?.data.map((instructor) => (
                <option key={instructor.id} value={instructor.id}>
                  {instructor.full_name}
                  {instructor.active === false ? ' (desativado)' : ''}
                </option>
              ))}
            </Form.Select>
          </Col>
        )}
        <Col xs={12} sm={6} lg={4}>
          <Form.Select aria-label="Filtrar por veículo" value={vehicleId} onChange={(event) => update({ veiculo: event.target.value })}>
            <option value="">Todos os veículos</option>
            {vehicles.data?.data.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plate} · {vehicle.model}
              </option>
            ))}
          </Form.Select>
        </Col>
      </Row>

      <p className="text-secondary small">Horários no fuso do espaço: {timeZone.replace('_', ' ')}.</p>

      <QueryState query={agenda} isEmpty={() => false} empty={null}>
        {(data) => {
          const selectedLessons = data.data.filter((lesson) => selectedIds.has(lesson.id) && lesson.status === 'scheduled')
          return (
            <>
              {data.meta.total > data.data.length && (
                <p className="small text-warning-emphasis">
                  Mostrando {data.data.length} de {data.meta.total} aulas: filtre por instrutor ou veículo.
                </p>
              )}
              {selectedLessons.length > 0 && (
                <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 border rounded p-3 mb-3 bg-body-tertiary" role="region" aria-label="Aulas selecionadas">
                  <span className="fw-semibold">
                    {selectedLessons.length} {selectedLessons.length === 1 ? 'aula selecionada' : 'aulas selecionadas'}
                  </span>
                  <div className="d-flex flex-wrap gap-2">
                    <Button variant="outline-secondary" onClick={() => setSelectedIds(new Set())}>
                      Limpar seleção
                    </Button>
                    <Button onClick={() => setBulkOpen(true)}>
                      <i className="bi bi-check2-all me-2" aria-hidden="true" />
                      Marcar como realizadas
                    </Button>
                  </div>
                </div>
              )}
              <AgendaDays
                days={days}
                lessons={data.data}
                today={today}
                timeZone={timeZone}
                columns={columns}
                selection={{ selected: selectedIds, canSelect: (lesson) => lesson.status === 'scheduled', onToggle: toggleSelected }}
                expansion={{ isOpen: (lesson) => expandedIds.has(lesson.id), onToggle: toggleExpanded, render: (lesson) => <LessonDetailsPanel lesson={lesson} href={links.lesson(lesson.id)} /> }}
              />
              {bulkOpen && (
                <CompleteSelectedModal
                  organizationId={organization.id}
                  lessons={selectedLessons}
                  onClose={() => setBulkOpen(false)}
                  onFinished={(failedIds) => setSelectedIds(new Set(failedIds))}
                />
              )}
            </>
          )
        }}
      </QueryState>

      {action?.kind === 'status' && (
        <StatusActionModal organizationId={organization.id} lesson={action.lesson} onClose={() => setAction(null)} />
      )}
      {action?.kind === 'reschedule' && (
        <RescheduleModal organizationId={organization.id} timeZone={timeZone} lesson={action.lesson} onClose={() => setAction(null)} />
      )}
    </>
  )
}

function toggleId(current: ReadonlySet<number>, id: number): ReadonlySet<number> {
  const next = new Set(current)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

// Ícone com rótulo acessível; no celular mostra o texto curto, porque o ícone sozinho fica pouco claro
function LessonActionButton({
  mobile,
  icon,
  label,
  short,
  expanded,
  onClick,
}: {
  mobile: boolean
  icon: string
  label: string
  short: string
  expanded?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={mobile ? 'btn btn-outline-secondary' : 'btn btn-outline-secondary btn-sm px-2'}
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      onClick={onClick}
    >
      <i className={`bi ${icon}${mobile ? ' me-2' : ''}`} aria-hidden="true" />
      {mobile && short}
    </button>
  )
}

// Detalhes que não cabem na linha da tabela; abre pelo botão de detalhes ou tocando no cartão
function LessonDetailsPanel({ lesson, href }: { lesson: Lesson; href: string }) {
  return (
    <div>
      <dl className="row small mb-2">
        <dt className="col-sm-4 col-md-3 text-secondary">Matrícula</dt>
        <dd className="col-sm-8 col-md-9">{lesson.enrollment ? `Categoria ${lesson.enrollment.category}` : '—'}</dd>
        <dt className="col-sm-4 col-md-3 text-secondary">Duração</dt>
        <dd className="col-sm-8 col-md-9">
          {lesson.scheduled_minutes} min agendados{lesson.actual_minutes ? ` · ${lesson.actual_minutes} min reais` : ''}
        </dd>
        {lesson.status_reason && (
          <>
            <dt className="col-sm-4 col-md-3 text-secondary">Motivo</dt>
            <dd className="col-sm-8 col-md-9">{lesson.status_reason}</dd>
          </>
        )}
        {lesson.evolution && (
          <>
            <dt className="col-sm-4 col-md-3 text-secondary">Evolução</dt>
            <dd className="col-sm-8 col-md-9">{lesson.evolution}</dd>
          </>
        )}
        {lesson.notes && (
          <>
            <dt className="col-sm-4 col-md-3 text-secondary">Observações</dt>
            <dd className="col-sm-8 col-md-9">{lesson.notes}</dd>
          </>
        )}
      </dl>
      <Link to={href} className="small">
        Abrir aula completa <i className="bi bi-arrow-right" aria-hidden="true" />
      </Link>
    </div>
  )
}

// StatusModal precisa da liberação e do saldo da matrícula, que a agenda não traz
function StatusActionModal({ organizationId, lesson, onClose }: { organizationId: number; lesson: Lesson; onClose: () => void }) {
  const enrollmentId = lesson.enrollment?.id
  const enrollment = useEnrollment(organizationId, String(enrollmentId ?? ''), enrollmentId !== undefined)
  if (enrollmentId !== undefined && enrollment.isPending) return null
  return (
    <StatusModal
      organizationId={organizationId}
      lesson={lesson}
      release={enrollment.data?.practice_release}
      balance={enrollment.data?.balance}
      onClose={onClose}
    />
  )
}

// Conclui as aulas selecionadas uma a uma; as que falharem (ex.: prática não liberada) continuam marcadas
function CompleteSelectedModal({
  organizationId,
  lessons,
  onClose,
  onFinished,
}: {
  organizationId: number
  lessons: Lesson[]
  onClose: () => void
  onFinished: (failedIds: number[]) => void
}) {
  const invalidate = useInvalidateOrganization(organizationId)
  const [running, setRunning] = useState(false)
  const [failures, setFailures] = useState<Array<{ id: number; message: string }> | null>(null)

  const run = async () => {
    setRunning(true)
    const results = await Promise.allSettled(lessons.map((lesson) => changeLessonStatus(organizationId, lesson.id, COMPLETE_WITHOUT_DETAILS)))
    const failed = results.flatMap((result, index) => (result.status === 'rejected' ? [{ id: lessons[index].id, message: toApiError(result.reason).message }] : []))
    await invalidate()
    setRunning(false)
    setFailures(failed)
    onFinished(failed.map((item) => item.id))
  }

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Marcar como realizadas
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {failures === null ? (
          <p className="mb-0">
            {lessons.length} {lessons.length === 1 ? 'aula será marcada' : 'aulas serão marcadas'} como realizadas, sem evolução nem duração real. Para
            registrar detalhes, abra a aula pelo botão Concluir.
          </p>
        ) : (
          <>
            <p className="fw-semibold mb-2">
              {lessons.length - failures.length} de {lessons.length} marcadas como realizadas.
            </p>
            {failures.length > 0 && (
              <ul className="small mb-0 ps-3">
                {failures.map((item) => (
                  <li key={item.id}>{item.message}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </Modal.Body>
      <Modal.Footer>
        {failures === null ? (
          <>
            <Button variant="outline-secondary" onClick={onClose} disabled={running}>
              Cancelar
            </Button>
            <Button onClick={run} disabled={running}>
              {running ? 'Marcando…' : 'Confirmar'}
            </Button>
          </>
        ) : (
          <Button onClick={onClose}>Fechar</Button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
