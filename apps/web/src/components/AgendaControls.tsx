import { Button, ButtonGroup, Form } from 'react-bootstrap'
import type { AgendaView } from '../hooks/useAgendaState'
import { addDays } from '../utils/timezone'

type AgendaControlsProps = {
  view: AgendaView
  date: string
  step: number
  onChange: (changes: Record<string, string | null>) => void
}

// Dia/semana, anterior/hoje/próximo e seletor de data. Quebra de linha no celular.
export function AgendaControls({ view, date, step, onChange }: AgendaControlsProps) {
  return (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
      <ButtonGroup aria-label="Visão da agenda">
        <Button variant={view === 'dia' ? 'primary' : 'outline-primary'} onClick={() => onChange({ visao: null })} aria-pressed={view === 'dia'}>
          Dia
        </Button>
        <Button variant={view === 'semana' ? 'primary' : 'outline-primary'} onClick={() => onChange({ visao: 'semana' })} aria-pressed={view === 'semana'}>
          Semana
        </Button>
      </ButtonGroup>
      <ButtonGroup aria-label="Navegar no calendário">
        <Button variant="outline-secondary" onClick={() => onChange({ data: addDays(date, -step) })} aria-label={view === 'semana' ? 'Semana anterior' : 'Dia anterior'}>
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </Button>
        <Button variant="outline-secondary" onClick={() => onChange({ data: null })}>
          Hoje
        </Button>
        <Button variant="outline-secondary" onClick={() => onChange({ data: addDays(date, step) })} aria-label={view === 'semana' ? 'Próxima semana' : 'Próximo dia'}>
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </Button>
      </ButtonGroup>
      <Form.Control type="date" aria-label="Ir para a data" value={date} onChange={(event) => event.target.value && onChange({ data: event.target.value })} className="agenda-date" />
    </div>
  )
}
