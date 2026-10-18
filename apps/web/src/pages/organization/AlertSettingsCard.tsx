import { useState } from 'react'
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap'
import { QueryState } from '../../components/QueryState'
import { useAlertSettings, useUpdateAlertSettings } from '../../hooks/useAlerts'
import type { AlertSettings } from '../../types/alert'

const FIELDS: Array<{ key: keyof Omit<AlertSettings, 'staff_receives'>; label: string; unit: string; min: number; max: number }> = [
  { key: 'crlv_lead_days', label: 'CRLV do veículo', unit: 'dias antes de vencer', min: 1, max: 180 },
  { key: 'document_lead_days', label: 'Documentos do aluno', unit: 'dias antes de vencer', min: 1, max: 180 },
  { key: 'exam_lead_days', label: 'Exames próximos', unit: 'dias antes', min: 1, max: 30 },
  { key: 'fee_lead_days', label: 'Taxas externas', unit: 'dias antes do vencimento', min: 1, max: 60 },
  { key: 'finance_lead_days', label: 'Contas a pagar e a receber', unit: 'dias antes do vencimento', min: 1, max: 60 },
  { key: 'release_lead_days', label: 'Aula sem liberação para a prática', unit: 'dias antes da aula', min: 1, max: 30 },
  { key: 'low_balance_minutes', label: 'Saldo de aulas baixo', unit: 'minutos restantes', min: 0, max: 1000 },
  { key: 'inactive_days', label: 'Aluno sem aula', unit: 'dias', min: 3, max: 180 },
  { key: 'lesson_grace_hours', label: 'Aula sem desfecho', unit: 'horas depois do fim', min: 0, max: 72 },
]

// Antecedência e destinatários dos alertas. Proprietário e gestor sempre recebem os alertas do espaço.
export function AlertSettingsCard({ organizationId, editable }: { organizationId: number; editable: boolean }) {
  const query = useAlertSettings(organizationId)

  return (
    <Card className="mt-4">
      <Card.Body>
        <Card.Title as="h2" className="h5">
          Notificações e alertas
        </Card.Title>
        <p className="small text-secondary">Defina com quanta antecedência o sistema avisa. Os alertas são recalculados sozinhos a cada 10 minutos.</p>
        <QueryState query={query} isEmpty={() => false} empty={null}>
          {(settings) => <Form_ key={JSON.stringify(settings)} organizationId={organizationId} settings={settings} editable={editable} />}
        </QueryState>
      </Card.Body>
    </Card>
  )
}

function Form_({ organizationId, settings, editable }: { organizationId: number; settings: AlertSettings; editable: boolean }) {
  const save = useUpdateAlertSettings(organizationId)
  const [draft, setDraft] = useState<Record<string, string>>(Object.fromEntries(FIELDS.map((f) => [f.key, String(settings[f.key])])))
  const [staff, setStaff] = useState(settings.staff_receives)

  const invalid = FIELDS.some((f) => !/^\d+$/.test(draft[f.key]) || Number(draft[f.key]) < f.min || Number(draft[f.key]) > f.max)

  return (
    <fieldset disabled={!editable}>
      <Row className="g-3">
        {FIELDS.map((f) => (
          <Col key={f.key} sm={6}>
            <Form.Group controlId={`alert-${f.key}`}>
              <Form.Label className="small mb-1">{f.label}</Form.Label>
              <div className="input-group">
                <Form.Control inputMode="numeric" value={draft[f.key]} isInvalid={!/^\d+$/.test(draft[f.key]) || Number(draft[f.key]) < f.min || Number(draft[f.key]) > f.max} onChange={(event) => setDraft({ ...draft, [f.key]: event.target.value })} />
                <span className="input-group-text">{f.unit}</span>
              </div>
            </Form.Group>
          </Col>
        ))}
      </Row>
      <Form.Check type="switch" id="alert-staff" className="mt-3" label="O perfil Equipe também recebe os alertas operacionais" checked={staff} onChange={(event) => setStaff(event.target.checked)} />
      {!editable && <Alert variant="info" className="mt-3 mb-0">Somente proprietários e gestores alteram estas configurações.</Alert>}
      {save.error && (
        <Alert variant="danger" className="mt-3" role="alert">
          {save.error.message}
        </Alert>
      )}
      {editable && (
        <Button className="mt-3" disabled={invalid || save.isPending} onClick={() => save.mutate({ ...Object.fromEntries(FIELDS.map((f) => [f.key, Number(draft[f.key])])), staff_receives: staff })}>
          Salvar configurações
        </Button>
      )}
    </fieldset>
  )
}
