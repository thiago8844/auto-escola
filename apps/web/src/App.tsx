import { useEffect, useState } from 'react'
import { Badge, Button, Card, Container } from 'react-bootstrap'
import { API_URL, APP_NAME } from './config'
import { checkApiHealth, type ApiStatus } from './lib/api'

type Status = ApiStatus | 'checking'

// Cor sempre acompanhada de texto e ícone, para não depender só da cor
const statusVisual: Record<Status, { text: string; bg: string; icon: string }> = {
  checking: { text: 'Verificando…', bg: 'secondary', icon: 'bi-hourglass-split' },
  online: { text: 'Online', bg: 'success', icon: 'bi-check-circle-fill' },
  offline: { text: 'Offline', bg: 'danger', icon: 'bi-x-circle-fill' },
}

function App() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    checkApiHealth().then(setStatus)
  }, [])

  const visual = statusVisual[status]

  return (
    <Container as="main" className="py-5">
      <h1>{APP_NAME}</h1>
      <p className="text-secondary">Painel do gestor da auto escola</p>

      <Card className="mt-4">
        <Card.Body>
          <Card.Title as="h2">Conexão com a API</Card.Title>
          <dl className="row mb-4">
            <dt className="col-sm-3">URL</dt>
            <dd className="col-sm-9"><code>{API_URL}</code></dd>
            <dt className="col-sm-3">Status</dt>
            <dd className="col-sm-9">
              <Badge bg={visual.bg}>
                <i className={`bi ${visual.icon} me-1`} aria-hidden="true" />
                {visual.text}
              </Badge>
            </dd>
          </dl>
          <Button
            variant="primary"
            onClick={() => {
              setStatus('checking')
              checkApiHealth().then(setStatus)
            }}
          >
            Testar novamente
          </Button>
        </Card.Body>
      </Card>
    </Container>
  )
}

export default App
