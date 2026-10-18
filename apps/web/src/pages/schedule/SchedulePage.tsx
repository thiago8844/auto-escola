import { Col, Form, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { AgendaControls } from '../../components/AgendaControls'
import { AgendaDays } from '../../components/AgendaDays'
import type { Column } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { LessonStatusBadge } from '../../components/StatusBadges'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useAgendaState } from '../../hooks/useAgendaState'
import { useInstructors } from '../../hooks/useInstructors'
import { useAgenda } from '../../hooks/useLessons'
import { useVehicles } from '../../hooks/useVehicles'
import type { Lesson } from '../../types/lesson'
import { canOperate } from '../../utils/permissions'
import { formatTime } from '../../utils/timezone'

export default function SchedulePage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const operate = canOperate(organization.role)
  const timeZone = organization.timezone
  const { searchParams, view, date, today, first, last, step, days, update } = useAgendaState(timeZone)
  const instructorId = searchParams.get('instrutor') ?? ''
  const vehicleId = searchParams.get('veiculo') ?? ''

  const agenda = useAgenda(organization.id, { from: first, to: last, instructorId, vehicleId })
  // Filtro por instrutor é da equipe (a listagem de instrutores não é aberta ao instrutor)
  const instructors = useInstructors(organization.id, { page: 1, all: true }, operate)
  const vehicles = useVehicles(organization.id, { page: 1, all: true })

  const columns: Column<Lesson>[] = [
    {
      header: 'Horário',
      primary: true,
      cell: (lesson) => (
        <Link to={links.lesson(lesson.id)} className="tabular-nums">
          {formatTime(lesson.starts_at, timeZone)}–{formatTime(lesson.ends_at, timeZone)}
        </Link>
      ),
    },
    { header: 'Aluno', cell: (lesson) => lesson.enrollment?.student?.name ?? '—' },
    { header: 'Instrutor', cell: (lesson) => lesson.instructor?.full_name ?? '—' },
    { header: 'Veículo', cell: (lesson) => (lesson.vehicle ? `${lesson.vehicle.plate} · ${lesson.vehicle.model}` : 'Sem veículo') },
    { header: 'Situação', cell: (lesson) => <LessonStatusBadge status={lesson.status} /> },
  ]

  return (
    <>
      <PageHeader
        title="Agenda"
        actions={
          operate && (
            <Link to={links.scheduleNew(`?data=${date}&instrutor=${instructorId}&veiculo=${vehicleId}`)} className="btn btn-primary">
              <i className="bi bi-plus-lg me-2" aria-hidden="true" />
              Agendar aula
            </Link>
          )
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
        {(data) => (
          <>
            {data.meta.total > data.data.length && (
              <p className="small text-warning-emphasis">
                Mostrando {data.data.length} de {data.meta.total} aulas: filtre por instrutor ou veículo.
              </p>
            )}
            <AgendaDays days={days} lessons={data.data} today={today} timeZone={timeZone} columns={columns} />
          </>
        )}
      </QueryState>
    </>
  )
}
