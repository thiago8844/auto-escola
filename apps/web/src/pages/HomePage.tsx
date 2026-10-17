import { Alert, Badge, Card, Col, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { paths } from '../config/paths'
import { useAuthStore } from '../stores/authStore'

// Protótipo: confirma que o login e a sessão funcionam. Os números são ilustrativos.
const sampleStats = [
  { label: 'Alunos ativos', value: '—', icon: 'bi-people' },
  { label: 'Aulas hoje', value: '—', icon: 'bi-calendar-check' },
  { label: 'Veículos', value: '—', icon: 'bi-car-front' },
]

export default function HomePage() {
  const user = useAuthStore((state) => state.user)

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-4">
        <h1 className="mb-0">Olá, {user?.name}</h1>
        <Badge bg="secondary">Protótipo</Badge>
      </div>

      {user && !user.email_verified && (
        <Alert variant="warning">
          <i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />
          Seu e-mail ainda não foi confirmado. <Link to={paths.verifyEmailNotice}>Confirmar agora</Link>
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Body>
          <Card.Title as="h2" className="h5">
            <i className="bi bi-check-circle-fill text-success me-2" aria-hidden="true" />
            Sessão ativa
          </Card.Title>
          <dl className="row mb-0">
            <dt className="col-sm-3">E-mail</dt>
            <dd className="col-sm-9">{user?.email}</dd>
            <dt className="col-sm-3">E-mail confirmado</dt>
            <dd className="col-sm-9 mb-0">{user?.email_verified ? 'Sim' : 'Não'}</dd>
          </dl>
        </Card.Body>
      </Card>

      <Row xs={1} md={3} className="g-4">
        {sampleStats.map((stat) => (
          <Col key={stat.label}>
            <Card>
              <Card.Body className="d-flex align-items-center gap-3">
                <i className={`bi ${stat.icon} fs-2 text-primary`} aria-hidden="true" />
                <div>
                  <div className="small text-secondary">{stat.label}</div>
                  <div className="fs-4 fw-semibold tabular-nums">{stat.value}</div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  )
}
