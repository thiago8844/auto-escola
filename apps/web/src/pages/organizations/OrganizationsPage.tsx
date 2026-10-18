import { Alert, Badge, Button, Card, Col, Row, Spinner } from 'react-bootstrap'
import { Link, useLocation } from 'react-router-dom'
import { usePreferencesStore } from '../../stores/preferencesStore'
import { PageHeader } from '../../components/PageHeader'
import { QueryErrorAlert } from '../../components/QueryErrorAlert'
import { RoleBadge } from '../../components/RoleBadge'
import { ORGANIZATION_TYPE_LABELS } from '../../config/organization'
import { organizationPaths, paths } from '../../config/paths'
import { useOrganizations } from '../../hooks/useOrganizations'

// Escolher o espaço leva para /espacos/:id, que passa a estar em todas as URLs
export default function OrganizationsPage() {
  const location = useLocation()
  const defaultSpace = usePreferencesStore((s) => s.defaultSpace)
  const setDefaultSpace = usePreferencesStore((s) => s.setDefaultSpace)
  const { data, error, isPending, refetch } = useOrganizations()

  return (
    <>
      <PageHeader
        title="Meus espaços"
        actions={
          <Link to={paths.organizationNew} className="btn btn-primary">
            <i className="bi bi-plus-lg me-2" aria-hidden="true" />
            Novo espaço
          </Link>
        }
      />

      {location.state?.invalidDefault && <Alert variant="info">Seu espaço inicial não está disponível. Escolha outro espaço abaixo.</Alert>}
      {isPending && !error && <Spinner animation="border" role="status" variant="primary" />}
      {error && <QueryErrorAlert error={error} onRetry={() => void refetch()} />}

      {data && data.data.length === 0 && (
        <Alert variant="info">
          Você ainda não tem acesso a nenhum espaço. <Link to={paths.organizationNew}>Crie o primeiro</Link> ou aceite um convite recebido por e-mail.
        </Alert>
      )}

      {data && data.data.length > 0 && (
        <Row xs={1} md={2} xl={3} className="g-4">
          {data.data.map((organization) => (
            <Col key={organization.id}>
              <Card className="h-100">
                <Card.Body className="d-flex flex-column">
                  <Card.Title as="h2" className="h5 text-break">
                    {organization.name}
                  </Card.Title>
                  <p className="small text-secondary mb-3">{ORGANIZATION_TYPE_LABELS[organization.type]}</p>
                  <div className="d-flex align-items-center justify-content-between mt-auto">
                    <RoleBadge role={organization.role} />
                    <Link to={organizationPaths(organization.id).home} className="btn btn-primary btn-sm">
                      Abrir
                    </Link>
                  </div>
                  <div className="mt-3">{defaultSpace === String(organization.id) ? <Badge bg="light" text="body" className="border"><i className="bi bi-star-fill me-1" aria-hidden="true" />Meu espaço inicial</Badge> : <Button variant="link" size="sm" className="px-0" onClick={() => setDefaultSpace(String(organization.id))}>Usar como espaço inicial</Button>}</div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </>
  )
}
