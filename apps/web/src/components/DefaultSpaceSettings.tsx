import { Card, Form } from 'react-bootstrap'
import { useOrganizations } from '../hooks/useOrganizations'
import { usePreferencesStore } from '../stores/preferencesStore'
import { QueryState } from './QueryState'

export function DefaultSpaceSettings() {
  const query = useOrganizations()
  const defaultSpace = usePreferencesStore((s) => s.defaultSpace)
  const setDefaultSpace = usePreferencesStore((s) => s.setDefaultSpace)
  return <Card className="mb-4"><Card.Body>
    <Card.Title as="h2" className="h5">Onde começar</Card.Title>
    <p className="small text-secondary">Escolha o espaço para abrir ao entrar. Links de convite e de registros continuam abrindo o destino recebido.</p>
    <QueryState query={query} isEmpty={() => false} empty={null}>{(data) => <Form.Group controlId="default-space">
      <Form.Label>Espaço inicial</Form.Label>
      <Form.Select value={data.data.some((o) => String(o.id) === defaultSpace) ? defaultSpace! : ''} onChange={(e) => setDefaultSpace(e.target.value || null)}>
        <option value="">Meus espaços — escolher ao entrar</option>
        {data.data.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.type === 'independent' ? 'Particular' : 'CFC'}</option>)}
      </Form.Select><Form.Text>Preferência pessoal salva neste navegador.</Form.Text>
    </Form.Group>}</QueryState>
  </Card.Body></Card>
}
