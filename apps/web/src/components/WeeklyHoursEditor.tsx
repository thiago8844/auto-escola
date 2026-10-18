import { Button, Form } from 'react-bootstrap'
import type { WeeklyHours } from '../types/availability'

const DAYS: Array<[string, string]> = [
  ['1', 'Segunda'],
  ['2', 'Terça'],
  ['3', 'Quarta'],
  ['4', 'Quinta'],
  ['5', 'Sexta'],
  ['6', 'Sábado'],
  ['7', 'Domingo'],
]

type WeeklyHoursEditorProps = { value: WeeklyHours; onChange: (value: WeeklyHours) => void; disabled?: boolean }

const defaultInterval = { start: '08:00', end: '18:00' }

// Editor semanal: cada dia tem uma ou duas faixas (ex.: manhã e tarde). Dia sem faixa = sem atendimento.
export function WeeklyHoursEditor({ value, onChange, disabled }: WeeklyHoursEditorProps) {
  const setDay = (day: string, intervals: WeeklyHours[string]) => {
    const next = { ...value }
    if (intervals.length === 0) delete next[day]
    else next[day] = intervals
    onChange(next)
  }

  const presetWeekdays = () => onChange(Object.fromEntries(['1', '2', '3', '4', '5'].map((day) => [day, [{ ...defaultInterval }]])))

  return (
    <div>
      <div className="d-grid gap-2">
        {DAYS.map(([day, label]) => {
          const intervals = value[day] ?? []
          return (
            <div key={day} className="d-flex flex-wrap align-items-center gap-2">
              <Form.Check
                type="switch"
                id={`hours-day-${day}`}
                className="hours-day-switch"
                label={label}
                checked={intervals.length > 0}
                disabled={disabled}
                onChange={(event) => setDay(day, event.target.checked ? [{ ...defaultInterval }] : [])}
              />
              {intervals.length === 0 && <span className="text-secondary small">Sem atendimento</span>}
              {intervals.map((interval, index) => (
                <span key={index} className="d-inline-flex align-items-center gap-1">
                  <Form.Control
                    type="time"
                    size="sm"
                    aria-label={`${label}: início da faixa ${index + 1}`}
                    value={interval.start}
                    disabled={disabled}
                    onChange={(event) => setDay(day, intervals.map((it, i) => (i === index ? { ...it, start: event.target.value } : it)))}
                  />
                  <span aria-hidden="true">–</span>
                  <Form.Control
                    type="time"
                    size="sm"
                    aria-label={`${label}: fim da faixa ${index + 1}`}
                    value={interval.end}
                    disabled={disabled}
                    onChange={(event) => setDay(day, intervals.map((it, i) => (i === index ? { ...it, end: event.target.value } : it)))}
                  />
                </span>
              ))}
              {intervals.length === 1 && !disabled && (
                <Button variant="link" size="sm" className="p-0" onClick={() => setDay(day, [{ start: intervals[0].start, end: '12:00' }, { start: '13:00', end: intervals[0].end }])}>
                  Dividir em duas faixas
                </Button>
              )}
              {intervals.length === 2 && !disabled && (
                <Button variant="link" size="sm" className="p-0 text-danger" onClick={() => setDay(day, [{ start: intervals[0].start, end: intervals[1].end }])}>
                  Juntar
                </Button>
              )}
            </div>
          )
        })}
      </div>
      {!disabled && (
        <Button variant="link" size="sm" className="px-0 mt-2" onClick={presetWeekdays}>
          Preencher segunda a sexta, 08:00–18:00
        </Button>
      )}
    </div>
  )
}
