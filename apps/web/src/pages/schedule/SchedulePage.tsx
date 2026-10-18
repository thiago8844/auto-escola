import { Button, ButtonGroup, Col, Form, Row } from 'react-bootstrap'
import { Link, useSearchParams } from 'react-router-dom'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { LessonStatusBadge } from '../../components/StatusBadges'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useInstructors } from '../../hooks/useInstructors'
import { useAgenda } from '../../hooks/useLessons'
import { useVehicles } from '../../hooks/useVehicles'
import type { Lesson } from '../../types/lesson'
import { canOperate } from '../../utils/permissions'
import { addDays, formatDayLabel, formatTime, isoToZonedParts, startOfWeek, todayInTimeZone } from '../../utils/timezone'

type View = 'dia' | 'semana'

export default function SchedulePage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const operate = canOperate(organization.role)
  const timeZone = organization.timezone
  const [searchParams, setSearchParams] = useSearchParams()

  // Visão, dia e filtros ficam na URL: dá para compartilhar o link e voltar com o botão do navegador
  const view: View = searchParams.get('visao') === 'semana' ? 'semana' : 'dia'
  const today = todayInTimeZone(timeZone)
  const rawDate = searchParams.get('data') ?? ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today
  const instructorId = searchParams.get('instrutor') ?? ''
  const vehicleId = searchParams.get('veiculo') ?? ''

  function update(changes: Record<string, string | null>) {
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }

  const first = view === 'semana' ? startOfWeek(date) : date
  const last = view === 'semana' ? addDays(first, 6) : date
  const step = view === 'semana' ? 7 : 1
  const days = Array.from({ length: view === 'semana' ? 7 : 1 }, (_, i) => addDays(first, i))

  const agenda = useAgenda(organization.id, { from: first, to: last, instructorId, vehicleId })
  // Filtro por instrutor é da equipe (a listagem de instrutores não é aberta ao instrutor)
  const instructors = useInstructors(organization.id, { page: 1, all: true }, operate)
  const vehicles = useVehicles(organization.id, { page: 1, all: true })

  const lessonsByDay = new Map<string, Lesson[]>()
  for (const lesson of [...(agenda.data?.data ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const day = isoToZonedParts(lesson.starts_at, timeZone).date
    lessonsByDay.set(day, [...(lessonsByDay.get(day) ?? []), lesson])
  }

  return (
    <>
      <PageHeader
        title="Agenda"
        actions={
          operate && (
            <Link to={links.scheduleNew(`?data=${date}`)} className="btn btn-primary">
              <i className="bi bi-plus-lg me-2" aria-hidden="true" />
              Agendar aula
            </Link>
          )
        }
      />

      <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
        <ButtonGroup aria-label="Visão da agenda">
          <Button variant={view === 'dia' ? 'primary' : 'outline-primary'} onClick={() => update({ visao: null })} aria-pressed={view === 'dia'}>
            Dia
          </Button>
          <Button variant={view === 'semana' ? 'primary' : 'outline-primary'} onClick={() => update({ visao: 'semana' })} aria-pressed={view === 'semana'}>
            Semana
          </Button>
        </ButtonGroup>
        <ButtonGroup aria-label="Navegar no calendário">
          <Button variant="outline-secondary" onClick={() => update({ data: addDays(date, -step) })} aria-label={view === 'semana' ? 'Semana anterior' : 'Dia anterior'}>
            <i className="bi bi-chevron-left" aria-hidden="true" />
          </Button>
          <Button variant="outline-secondary" onClick={() => update({ data: null })}>
            Hoje
          </Button>
          <Button variant="outline-secondary" onClick={() => update({ data: addDays(date, step) })} aria-label={view === 'semana' ? 'Próxima semana' : 'Próximo dia'}>
            <i className="bi bi-chevron-right" aria-hidden="true" />
          </Button>
        </ButtonGroup>
        <Form.Control type="date" aria-label="Ir para a data" value={date} onChange={(event) => event.target.value && update({ data: event.target.value })} className="agenda-date" />
      </div>

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
            {data.meta.total > data.data.length && <p className="small text-warning-emphasis">Mostrando {data.data.length} de {data.meta.total} aulas: filtre por instrutor ou veículo.</p>}
            {days.map((day) => {
              const lessons = lessonsByDay.get(day) ?? []
              return (
                <section key={day} className="mb-4" aria-labelledby={`day-${day}`}>
                  <h2 id={`day-${day}`} className="h5 text-capitalize">
                    {formatDayLabel(day)}
                    {day === today && <span className="badge text-bg-primary ms-2 text-uppercase">Hoje</span>}
                  </h2>
                  {lessons.length === 0 ? (
                    <p className="text-secondary">Sem aulas.</p>
                  ) : (
                    <DataTable
                      rows={lessons}
                      getKey={(lesson) => lesson.id}
                      columns={[
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
                      ]}
                    />
                  )}
                </section>
              )
            })}
          </>
        )}
      </QueryState>
    </>
  )
}
