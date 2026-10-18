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

// Espaços diferentes podem ter fusos diferentes e a aula não informa o fuso do espaço:
// a agenda pessoal usa o fuso do aparelho, tanto para o dia consultado quanto para os horários.
const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

export default function MyLessonsPage() {
  const { view, date, today, first, last, step, days, update } = useAgendaState(deviceTimeZone)
  const query = useMyLessons({ from: first, to: last, timezone: deviceTimeZone })

  const columns: Column<Lesson>[] = [
    {
      header: 'Horário',
      primary: true,
      cell: (lesson) => {
        const time = `${formatTime(lesson.starts_at, deviceTimeZone)}–${formatTime(lesson.ends_at, deviceTimeZone)}`
        return lesson.organization ? (
          <Link to={organizationPaths(lesson.organization.id).lesson(lesson.id)} className="tabular-nums">
            {time}
          </Link>
        ) : (
          <span className="tabular-nums">{time}</span>
        )
      },
    },
    { header: 'Espaço', cell: (lesson) => lesson.organization?.name ?? '—' },
    { header: 'Aluno', cell: (lesson) => lesson.enrollment?.student?.name ?? '—' },
    { header: 'Situação', cell: (lesson) => <LessonStatusBadge status={lesson.status} /> },
  ]

  return (
    <>
      <PageHeader title="Minha agenda" subtitle="Suas aulas como instrutor, em todos os espaços." />

      <AgendaControls view={view} date={date} step={step} onChange={update} />
      <p className="text-secondary small">
        Horários no fuso deste aparelho: {deviceTimeZone.replace('_', ' ')}. Para criar seu perfil de instrutor, veja <Link to={paths.myProfile}>Perfil profissional</Link>.
      </p>

      <QueryState query={query} isEmpty={() => false} empty={null}>
        {(data) => (
          <>
            {data.meta.total > data.data.length && (
              <p className="small text-warning-emphasis">
                Mostrando {data.data.length} de {data.meta.total} aulas.
              </p>
            )}
            <AgendaDays days={days} lessons={data.data} today={today} timeZone={deviceTimeZone} columns={columns} />
          </>
        )}
      </QueryState>
    </>
  )
}
