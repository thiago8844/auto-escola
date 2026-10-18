import { Alert, Badge, Card, Col, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { OnboardingGuide } from '../../components/OnboardingGuide'
import { QueryState } from '../../components/QueryState'
import { ORGANIZATION_TYPE_LABELS } from '../../config/organization'
import { organizationPaths, paths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useDashboard } from '../../hooks/useReports'
import { useAuthStore } from '../../stores/authStore'
import type { DashboardStaff } from '../../types/reports'
import { formatDateTime } from '../../utils/formatDateTime'
import { canOperate } from '../../utils/permissions'
import { addDays, todayInTimeZone } from '../../utils/timezone'

type CardProps = { icon: string; label: string; value: number | string; hint?: string; to: string; tone?: 'danger' | 'warning' }

function IndicatorCard({ icon, label, value, hint, to, tone }: CardProps) {
  return (
    <Col>
      <Card as={Link} to={to} className="h-100 text-decoration-none indicator-card">
        <Card.Body className="d-flex align-items-center gap-3">
          <i className={`bi ${icon} fs-2 ${tone ? `text-${tone}` : 'text-primary'}`} aria-hidden="true" />
          <div>
            <div className="small text-secondary">{label}</div>
            <div className="fs-4 fw-semibold tabular-nums">{value}</div>
            {hint && <div className="small text-secondary">{hint}</div>}
          </div>
        </Card.Body>
      </Card>
    </Col>
  )
}

// Painel com dados reais. Cada indicador leva à lista que o compõe.
export default function OrganizationHomePage() {
  const organization = useActiveOrganization()
  const user = useAuthStore((state) => state.user)
  const links = organizationPaths(organization.id)
  const staff = canOperate(organization.role)
  const query = useDashboard(organization.id)
  const today = todayInTimeZone(organization.timezone)

  return (
    <>
      <h1 className="mb-1 text-break">{organization.name}</h1>
      <p className="text-secondary mb-4">
        {ORGANIZATION_TYPE_LABELS[organization.type]} · Olá, {user?.name}
      </p>

      {user && !user.email_verified && (
        <Alert variant="warning">
          <i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />
          Seu e-mail ainda não foi confirmado. <Link to={paths.verifyEmailNotice}>Confirmar agora</Link>
        </Alert>
      )}

      {staff && <OnboardingGuide organizationId={organization.id} />}

      <QueryState query={query} isEmpty={() => false} empty={null}>
        {(data) =>
          data.scope === 'staff' ? (
            <StaffDashboard data={data} timezone={organization.timezone} organizationId={organization.id} today={today} />
          ) : (
            <Row xs={1} md={3} className="g-4">
              <IndicatorCard icon="bi-calendar-check" label="Minhas aulas hoje" value={data.today.total} to={links.schedule} />
              <IndicatorCard icon="bi-calendar-week" label="Minhas aulas na semana" value={data.week.total} to={links.schedule} />
              <IndicatorCard icon="bi-bell" label="Pendências para mim" value={data.pending.open} to={links.alerts} tone={data.pending.open > 0 ? 'warning' : undefined} />
            </Row>
          )
        }
      </QueryState>
    </>
  )
}

function StaffDashboard({ data, timezone, organizationId, today }: { data: DashboardStaff; timezone: string; organizationId: number; today: string }) {
  const links = organizationPaths(organizationId)
  const reports = (query: string) => `${links.reports}?${query}`
  const weekFrom = data.week.from
  const weekTo = data.week.to

  return (
    <>
      <Row xs={1} md={2} xl={3} className="g-4 mb-4">
        <IndicatorCard icon="bi-calendar-check" label="Aulas hoje" value={data.today.total} hint={`${data.today.scheduled} a realizar · ${data.today.completed} realizadas`} to={links.schedule} />
        <IndicatorCard icon="bi-calendar-week" label="Aulas na semana" value={data.week.total} hint={`${data.week.completed} realizadas · ${data.week.missed} faltas`} to={reports(`de=${weekFrom}&ate=${weekTo}`)} />
        <IndicatorCard icon="bi-mortarboard" label="Alunos em atendimento" value={data.students_in_service} to={`${links.enrollments}?situacao=in_service`} />
        <IndicatorCard
          icon="bi-bell"
          label="Pendências abertas"
          value={data.pending.open}
          hint={data.pending.critical + data.pending.high > 0 ? `${data.pending.critical} urgentes · ${data.pending.high} importantes` : 'Tudo em dia'}
          to={links.alerts}
          tone={data.pending.critical > 0 ? 'danger' : data.pending.high > 0 ? 'warning' : undefined}
        />
        <IndicatorCard
          icon="bi-hourglass-split"
          label="Saldo de aulas baixo"
          value={data.low_balance.count}
          hint={data.low_balance.exhausted > 0 ? `${data.low_balance.exhausted} esgotados` : undefined}
          to={`${links.alerts}`}
          tone={data.low_balance.exhausted > 0 ? 'warning' : undefined}
        />
        <IndicatorCard icon="bi-clipboard-check" label="Exames nos próximos 14 dias" value={data.upcoming_exams.length} to={`${links.exams}?de=${today}&ate=${addDays(today, 14)}&situacao=scheduled`} />
      </Row>

      <Row className="g-4">
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title as="h2" className="h5">Próximas aulas</Card.Title>
              {data.next_lessons.length === 0 ? (
                <p className="text-secondary mb-0">Nenhuma aula agendada. <Link to={links.scheduleNew()}>Agendar uma aula</Link></p>
              ) : (
                <ul className="list-unstyled mb-0 d-grid gap-2">
                  {data.next_lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <Link to={links.lesson(lesson.id)} className="tabular-nums">{formatDateTime(lesson.starts_at, timezone)}</Link>{' '}
                      <span>{lesson.student ?? 'Aluno'}</span>
                      <span className="text-secondary small"> · {lesson.instructor ?? 'sem instrutor'}{lesson.vehicle ? ` · ${lesson.vehicle}` : ''}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>
        </Col>
        <Col lg={6}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title as="h2" className="h5">Próximos exames</Card.Title>
              {data.upcoming_exams.length === 0 ? (
                <p className="text-secondary mb-0">Nenhum exame agendado nos próximos 14 dias.</p>
              ) : (
                <ul className="list-unstyled mb-0 d-grid gap-2">
                  {data.upcoming_exams.map((exam) => (
                    <li key={exam.id}>
                      <Link to={links.exam(exam.id)} className="tabular-nums">{formatDateTime(exam.scheduled_at, timezone)}</Link>{' '}
                      <Badge bg="primary">{exam.category}</Badge> <span>{exam.student ?? 'Aluno'}</span>
                      {exam.location && <span className="text-secondary small"> · {exam.location}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  )
}
