import { useState } from 'react'
import { Badge, Button, Card, Col, Form, Nav, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { ALERT_CATEGORIES, PRIORITY_LABEL, PRIORITY_NOTICE } from '../../config/alerts'
import { NOTICE_TYPES } from '../../config/notices'
import { PAGE_SIZE } from '../../config/organization'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useAlerts, useArchiveAlert, useMarkAlertRead, useMarkAllAlertsRead, useRefreshAlerts, useUnarchiveAlert } from '../../hooks/useAlerts'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import { alertPath } from '../../utils/alertPath'
import { formatDate } from '../../utils/formatDate'
import { formatRelativeTime } from '../../utils/formatRelativeTime'

type Tab = 'open' | 'resolved' | 'archived'

// Todas as pendências do espaço que o usuário pode ver, com ação direta no registro de origem
export default function AlertsPage() {
  const organization = useActiveOrganization()
  const [page, setPage] = usePageParam()
  const [tab, setTab] = useState<Tab>('open')
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('')

  const query = useAlerts(organization.id, {
    page,
    perPage: PAGE_SIZE,
    status: tab === 'resolved' ? 'resolved' : tab === 'archived' ? 'all' : 'open',
    archived: tab === 'archived',
    category,
    priority,
  })
  useClampPage(page, query.data?.meta.last_page, setPage)
  const markRead = useMarkAlertRead(organization.id)
  const markAll = useMarkAllAlertsRead(organization.id)
  const archive = useArchiveAlert(organization.id)
  const unarchive = useUnarchiveAlert(organization.id)
  const refresh = useRefreshAlerts(organization.id)

  return (
    <>
      <PageHeader
        title="Pendências"
        subtitle="O que precisa de ação no seu espaço. A lista se atualiza sozinha e some quando a pendência é resolvida."
        actions={
          <>
            <Button variant="outline-secondary" onClick={() => refresh.mutate(undefined)} disabled={refresh.isPending}>
              <i className="bi bi-arrow-clockwise me-2" aria-hidden="true" />
              Atualizar
            </Button>
            {tab === 'open' && (
              <Button variant="outline-primary" onClick={() => markAll.mutate(undefined)} disabled={markAll.isPending || (query.data?.meta.unread ?? 0) === 0}>
                Marcar todas como lidas
              </Button>
            )}
          </>
        }
      />

      <Nav variant="pills" className="mb-3" activeKey={tab} onSelect={(key) => { setTab((key as Tab) ?? 'open'); setPage(1, true) }}>
        <Nav.Item>
          <Nav.Link eventKey="open">
            Abertas {query.data && tab === 'open' ? <Badge bg="secondary">{query.data.meta.total}</Badge> : null}
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="resolved">Resolvidas</Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link eventKey="archived">Arquivadas</Nav.Link>
        </Nav.Item>
      </Nav>

      <Row className="g-2 mb-3">
        <Col xs={6} md={3}>
          <Form.Label htmlFor="alert-category" className="small mb-1">Assunto</Form.Label>
          <Form.Select id="alert-category" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1, true) }}>
            <option value="">Todos</option>
            {Object.entries(ALERT_CATEGORIES).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Form.Select>
        </Col>
        <Col xs={6} md={3}>
          <Form.Label htmlFor="alert-priority" className="small mb-1">Prioridade</Form.Label>
          <Form.Select id="alert-priority" value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1, true) }}>
            <option value="">Todas</option>
            {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Form.Select>
        </Col>
      </Row>

      <QueryState
        query={query}
        isEmpty={(data) => data.data.length === 0}
        empty={tab === 'open' ? 'Tudo em dia. Nenhuma pendência aberta.' : tab === 'resolved' ? 'Nenhuma pendência resolvida ainda.' : 'Nenhuma pendência arquivada.'}
      >
        {(data) => (
          <>
            <ul className="list-unstyled d-grid gap-2 mb-3">
              {data.data.map((alert) => {
                const noticeType = PRIORITY_NOTICE[alert.priority]
                const category = ALERT_CATEGORIES[alert.category]
                return (
                  <li key={alert.id}>
                    <Card className={alert.read_at || alert.status === 'resolved' ? '' : 'border-primary'}>
                      <Card.Body className="d-flex flex-column flex-md-row gap-3 align-items-md-center">
                        <span className={`fs-4 text-${noticeType === 'error' ? 'danger' : noticeType === 'warning' ? 'warning' : 'info'}`} aria-hidden="true">
                          <i className={`bi ${NOTICE_TYPES[noticeType].icon}`} />
                        </span>
                        <div className="min-w-0 flex-grow-1">
                          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
                            <Badge bg={alert.priority === 'critical' ? 'danger' : alert.priority === 'high' ? 'warning' : 'secondary'} text={alert.priority === 'high' ? 'dark' : undefined}>
                              {PRIORITY_LABEL[alert.priority]}
                            </Badge>
                            <span className="small text-secondary">
                              <i className={`bi ${category?.icon ?? 'bi-dot'} me-1`} aria-hidden="true" />
                              {category?.label ?? alert.category}
                            </span>
                            {!alert.read_at && alert.status === 'open' && <Badge bg="primary">Nova</Badge>}
                            {alert.status === 'resolved' && <Badge bg="success">Resolvida</Badge>}
                          </div>
                          <div className="fw-semibold text-break">{alert.title}</div>
                          {alert.message && <div className="text-secondary text-break">{alert.message}</div>}
                          <div className="small text-secondary mt-1">
                            {formatRelativeTime(alert.first_seen_at)}
                            {alert.due_on && <> · prazo {formatDate(alert.due_on)}</>}
                            {alert.resolved_at && <> · resolvida {formatRelativeTime(alert.resolved_at)}</>}
                          </div>
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          <Link to={alertPath(organization.id, alert)} className="btn btn-primary btn-sm" onClick={() => { if (!alert.read_at) markRead.mutate(alert.id) }}>
                            Abrir
                          </Link>
                          {!alert.read_at && alert.status === 'open' && (
                            <Button size="sm" variant="outline-secondary" onClick={() => markRead.mutate(alert.id)}>
                              Marcar como lida
                            </Button>
                          )}
                          {tab === 'archived' ? (
                            <Button size="sm" variant="outline-secondary" onClick={() => unarchive.mutate(alert.id)}>
                              Restaurar
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline-secondary" onClick={() => archive.mutate(alert.id)}>
                              Arquivar
                            </Button>
                          )}
                        </div>
                      </Card.Body>
                    </Card>
                  </li>
                )
              })}
            </ul>
            <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </QueryState>
    </>
  )
}
