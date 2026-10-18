import { Link } from 'react-router-dom'
import { AgendaControls } from '../../components/AgendaControls'
import { AgendaDays } from '../../components/AgendaDays'
import type { Column } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { LessonStatusBadge } from '../../components/StatusBadges'
import { organizationPaths, paths } from '../../config/paths'
import { useAgendaState } from '../../hooks/useAgendaState'
import { useMyLessons } from '../../hooks/useMe'
import type { Lesson } from '../../types/lesson'
import { formatTime } from '../../utils/timezone'

// O dia consultado vale no fuso do aparelho; cada aula é exibida no fuso do espaço dela
const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

const timeZoneOf = (lesson: Lesson) => lesson.organization?.timezone ?? deviceTimeZone

export default function MyLessonsPage() {
  const { view, date, today, first, last, step, days, update } = useAgendaState(deviceTimeZone)
  const query = useMyLessons({ from: first, to: last, timezone: deviceTimeZone })

  const columns: Column<Lesson>[] = [
    {
      header: 'Horário',
      primary: true,
      cell: (lesson) => {
        const zone = timeZoneOf(lesson)
        const time = `${formatTime(lesson.starts_at, zone)}–${formatTime(lesson.ends_at, zone)}`
        return <span className="tabular-nums">{time}</span>
      },
    },
    {
      header: 'Espaço',
      cell: (lesson) => (
        <>
          {lesson.organization?.name ?? '—'}
          {lesson.organization?.timezone && lesson.organization.timezone !== deviceTimeZone && (
            <span className="d-block small text-secondary">Fuso: {lesson.organization.timezone.replace('_', ' ')}</span>
          )}
        </>
      ),
    },
    { header: 'Aluno', cell: (lesson) => lesson.enrollment?.student?.name ?? '—' },
    { header: 'Situação', cell: (lesson) => <LessonStatusBadge status={lesson.status} /> },
  ]

  return (
    <>
      <PageHeader title="Minha agenda" subtitle="Suas aulas como instrutor, em todos os espaços." />

      <AgendaControls view={view} date={date} step={step} onChange={update} />
      <p className="text-secondary small">
        Cada aula mostra o horário no fuso do espaço dela (o dia consultado segue o fuso deste aparelho: {deviceTimeZone.replace('_', ' ')}). Para criar seu perfil de instrutor, veja <Link to={paths.myProfile}>Perfil profissional</Link>.
      </p>

      <QueryState query={query} isEmpty={() => false} empty={null}>
        {(data) => (
          <>
            {data.meta.total > data.data.length && (
              <p className="small text-warning-emphasis">
                Mostrando {data.data.length} de {data.meta.total} aulas.
              </p>
            )}
            <AgendaDays days={days} lessons={data.data} today={today} timeZone={deviceTimeZone} timeZoneOf={timeZoneOf} columns={columns}
              open={{ to: (lesson) => (lesson.organization ? organizationPaths(lesson.organization.id).lesson(lesson.id) : '/'), label: (lesson) => `aula de ${lesson.enrollment?.student?.name ?? 'aluno'}` }}
            />
          </>
        )}
      </QueryState>
    </>
  )
}
