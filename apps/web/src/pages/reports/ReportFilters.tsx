import { Button, ButtonGroup, Col, Form, Row } from 'react-bootstrap'
import { addDays, todayInTimeZone } from '../../utils/timezone'

type Props = { timezone: string; from: string; to: string; onChange: (from: string, to: string) => void }

// Período do relatório (no fuso do espaço) com atalhos de um clique
export function PeriodFilter({ timezone, from, to, onChange }: Props) {
  const today = todayInTimeZone(timezone)
  const monthStart = `${today.slice(0, 7)}-01`
  const presets: Array<[string, string, string]> = [
    ['Hoje', today, today],
    ['7 dias', addDays(today, -6), today],
    ['30 dias', addDays(today, -29), today],
    ['Este mês', monthStart, today],
  ]
  const invalid = from !== '' && to !== '' && to < from

  return (
    <div className="mb-3">
      <Row className="g-2 align-items-end">
        <Col xs={6} md={3}>
          <Form.Label htmlFor="report-from" className="small mb-1">De</Form.Label>
          <Form.Control id="report-from" type="date" value={from} isInvalid={invalid} onChange={(event) => onChange(event.target.value, to)} />
        </Col>
        <Col xs={6} md={3}>
          <Form.Label htmlFor="report-to" className="small mb-1">Até</Form.Label>
          <Form.Control id="report-to" type="date" value={to} isInvalid={invalid} onChange={(event) => onChange(from, event.target.value)} />
        </Col>
        <Col xs={12} md="auto">
          <ButtonGroup aria-label="Atalhos de período">
            {presets.map(([label, start, end]) => (
              <Button key={label} variant={from === start && to === end ? 'primary' : 'outline-secondary'} onClick={() => onChange(start, end)}>
                {label}
              </Button>
            ))}
          </ButtonGroup>
        </Col>
      </Row>
      {invalid && <p className="small text-danger mt-1 mb-0">A data final não pode ser anterior à inicial.</p>}
      <p className="small text-secondary mt-2 mb-0">Dias no fuso do espaço ({timezone.replace('_', ' ')}).</p>
    </div>
  )
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border rounded p-3 h-100">
      <div className="small text-secondary">{label}</div>
      <div className="fs-4 fw-semibold tabular-nums">{value}</div>
      {hint && <div className="small text-secondary">{hint}</div>}
    </div>
  )
}
