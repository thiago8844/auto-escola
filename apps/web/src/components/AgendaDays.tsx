import { DataTable, type Column, type TableOpen, type TableSelection } from './DataTable'
import type { Lesson } from '../types/lesson'
import { formatDayLabel, isoToZonedParts } from '../utils/timezone'

type AgendaDaysProps = {
  days: string[]
  lessons: Lesson[]
  today: string
  timeZone: string
  columns: Column<Lesson>[]
  // Fuso de cada aula, quando varia (agenda pessoal mistura espaços); senão vale `timeZone`
  timeZoneOf?: (lesson: Lesson) => string
  // Repassados para cada tabela de dia (seleção e abertura da aula)
  selection?: TableSelection<Lesson>
  open?: TableOpen<Lesson>
}

// Aulas agrupadas por dia (no fuso informado), cada dia com a sua tabela
export function AgendaDays({ days, lessons, today, timeZone, columns, timeZoneOf, selection, open }: AgendaDaysProps) {
  const byDay = new Map<string, Lesson[]>()
  for (const lesson of [...lessons].sort((a, b) => a.starts_at.localeCompare(b.starts_at))) {
    const day = isoToZonedParts(lesson.starts_at, timeZoneOf?.(lesson) ?? timeZone).date
    byDay.set(day, [...(byDay.get(day) ?? []), lesson])
  }

  return (
    <>
      {days.map((day) => {
        const dayLessons = byDay.get(day) ?? []
        return (
          <section key={day} className="mb-4" aria-labelledby={`day-${day}`}>
            <h2 id={`day-${day}`} className="h5 text-capitalize">
              {formatDayLabel(day)}
              {day === today && <span className="badge text-bg-primary ms-2 text-uppercase">Hoje</span>}
            </h2>
            {dayLessons.length === 0 ? (
              <p className="text-secondary">Sem aulas.</p>
            ) : (
              <DataTable rows={dayLessons} getKey={(lesson) => lesson.id} columns={columns} selection={selection} open={open} />
            )}
          </section>
        )
      })}
    </>
  )
}
