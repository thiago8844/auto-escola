import { Alert, Badge, Card, Col, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { ORGANIZATION_TYPE_LABELS } from '../../config/organization'
import { paths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useAuthStore } from '../../stores/authStore'

// Protótipo: confirma que login, sessão e espaço ativo funcionam. Os cards ainda não têm dados.
const sampleStats = [
  { label: 'Alunos ativos', icon: 'bi-people' },
  { label: 'Aulas hoje', icon: 'bi-calendar-check' },
  { label: 'Veículos', icon: 'bi-car-front' },
]

export default function OrganizationHomePage() {
  const organization = useActiveOrganization()
  const user = useAuthStore((state) => state.user)

  return (
    <>
      <div className="d-flex align-items-center gap-3 mb-1">
        <h1 className="mb-0 text-break">{organization.name}</h1>
        <Badge bg="secondary">Protótipo</Badge>
      </div>
      <p className="text-secondary mb-4">
        {ORGANIZATION_TYPE_LABELS[organization.type]} · Olá, {user?.name}
      </p>

      {user && !user.email_verified && (
        <Alert variant="warning">
          <i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />
          Seu e-mail ainda não foi confirmado. <Link to={paths.verifyEmailNotice}>Confirmar agora</Link>
        </Alert>
      )}

      <Row xs={1} md={3} className="g-4">
        {sampleStats.map((stat) => (
          <Col key={stat.label}>
            <Card>
              <Card.Body className="d-flex align-items-center gap-3">
                <i className={`bi ${stat.icon} fs-2 text-primary`} aria-hidden="true" />
                <div>
                  <div className="small text-secondary">{stat.label}</div>
                  <div className="fs-4 fw-semibold tabular-nums">—</div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  )
}
