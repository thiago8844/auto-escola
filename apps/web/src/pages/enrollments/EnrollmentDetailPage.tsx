import { AssignmentPanel } from './AssignmentPanel'
import { RecordSection } from '../../components/RecordSection'
import { useState } from 'react'
import { Alert, Button, Card, Form } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { ReleasePanel } from '../../components/ReleasePanel'
import { EnrollmentStatusBadge, LessonStatusBadge } from '../../components/StatusBadges'
import { ENROLLMENT_STATUS } from '../../config/domain'
import { organizationPaths } from '../../config/paths'
import { BalancePanel } from './BalancePanel'
import { EnrollmentEditModal } from './EnrollmentEditModal'
import { EnrollmentFinancePanel } from './EnrollmentFinancePanel'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useCompleteLesson, useEnrollment, useEnrollmentLessons, useUpdateEnrollmentStatus } from '../../hooks/useEnrollments'
import { notify } from '../../stores/toastStore'
import type { Enrollment, EnrollmentStatus } from '../../types/enrollment'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDateTime } from '../../utils/formatDateTime'
import { formatMinutes } from '../../utils/formatMinutes'
import { canOperate } from '../../utils/permissions'

export default function EnrollmentDetailPage() {
  const { enrollmentId = '' } = useParams()
  const organization = useActiveOrganization()
  const query = useEnrollment(organization.id, enrollmentId)

  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(enrollment) => <EnrollmentDetail enrollment={enrollment} />}
    </QueryState>
  )
}

function EnrollmentDetail({ enrollment }: { enrollment: Enrollment }) {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const operate = canOperate(organization.role)
  const release = enrollment.practice_release
  // A tela também bloqueia: sem liberação, "concluir aula" nem é oferecido
  const practiceBlocked = release !== undefined && !release.released

  const updateStatus = useUpdateEnrollmentStatus(organization.id, String(enrollment.id))
  const lessons = useEnrollmentLessons(organization.id, String(enrollment.id))
  const complete = useCompleteLesson(organization.id)
  const [editing, setEditing] = useState(false)

  return (
    <>
      <PageHeader
        title={`Matrícula · Categoria ${enrollment.category}`}
        subtitle={enrollment.student && <Link to={links.student(enrollment.student.id)}>{enrollment.student.name}</Link>}
        actions={
          <>
            <EnrollmentStatusBadge status={enrollment.status} />
            {operate && (
              <>
                <Button size="sm" variant="outline-secondary" onClick={() => setEditing(true)}>
                  <i className="bi bi-pencil me-1" aria-hidden="true" />
                  Corrigir dados
                </Button>
                <Link to={links.scheduleNew(`?matricula=${enrollment.id}`)} className="btn btn-sm btn-primary">
                  Agendar aula
                </Link>
              </>
            )}
          </>
        }
      />

      <AssignmentPanel organizationId={organization.id} enrollment={enrollment} operate={operate} />

      <Card className="mb-4">
        <Card.Body>
          <dl className="row mb-0">
            <dt className="col-sm-4 col-md-3">Serviço contratado</dt>
            <dd className="col-sm-8 col-md-9">{enrollment.contracted_minutes ? formatMinutes(enrollment.contracted_minutes) : '—'}</dd>
            {operate && (
              <>
                <dt className="col-sm-4 col-md-3">Valor do contrato</dt>
                <dd className="col-sm-8 col-md-9">{enrollment.price_cents != null ? formatCurrency(enrollment.price_cents / 100) : '—'}</dd>
                <dt className="col-sm-4 col-md-3">Observações</dt>
                <dd className="col-sm-8 col-md-9 text-break">{enrollment.notes ?? '—'}</dd>
                <dt className="col-sm-4 col-md-3">Alterar situação</dt>
                <dd className="col-sm-8 col-md-9 mb-0">
                  <Form.Select
                    className="form-narrow"
                    aria-label="Situação da matrícula"
                    value={enrollment.status}
                    disabled={updateStatus.isPending}
                    onChange={(event) =>
                      updateStatus.mutate(event.target.value as EnrollmentStatus, { onSuccess: () => notify.success('Situação atualizada.') })
                    }
                  >
                    {Object.entries(ENROLLMENT_STATUS).map(([value, { label }]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Form.Select>
                </dd>
              </>
            )}
          </dl>
        </Card.Body>
      </Card>

      {enrollment.balance && operate && <Alert variant="light" className="border mb-4"><strong>Disponível: {formatMinutes(enrollment.balance.available)}</strong><span className="text-secondary ms-2">· minutos para novas aulas</span></Alert>}
      {operate && (
        <RecordSection title="Pacote de aulas" defaultOpen={!enrollment.balance?.has_package}>
        <BalancePanel organizationId={organization.id} timezone={organization.timezone} enrollment={enrollment} canAdjust={organization.role === 'owner' || organization.role === 'admin'} />
        </RecordSection>
      )}

      {operate && <RecordSection title="Cobrança e recebimentos"><EnrollmentFinancePanel organization={organization} enrollment={enrollment} canManage={organization.role === 'owner' || organization.role === 'admin'} /></RecordSection>}

      <section className="mb-4" aria-labelledby="release-title">
        <h2 id="release-title" className="h4 mb-3">
          Liberação para a prática
        </h2>
        {release ? (
          <ReleasePanel release={release} processLink={operate && enrollment.qualification_process_id ? links.process(enrollment.qualification_process_id) : undefined} />
        ) : (
          <Alert variant="secondary" className="mb-0">
            Esta matrícula não tem processo de habilitação, então não há checklist e a prática não é bloqueada.
          </Alert>
        )}
      </section>

      <section aria-labelledby="lessons-title">
        <h2 id="lessons-title" className="h4 mb-3">
          Aulas
        </h2>

        {complete.error && (
          <Alert variant="danger" role="alert" dismissible onClose={() => complete.reset()}>
            {complete.error.message}
          </Alert>
        )}

        <QueryState query={lessons} isEmpty={(data) => data.data.length === 0} empty="Nenhuma aula agendada para esta matrícula.">
          {(data) => (
            <>
              <DataTable
                rows={data.data}
                getKey={(lesson) => lesson.id}
                columns={[
                  {
                    header: 'Data e hora',
                    primary: true,
                    cell: (lesson) => (
                      <Link to={links.lesson(lesson.id)} className="tabular-nums">
                        {formatDateTime(lesson.starts_at, organization.timezone)}
                      </Link>
                    ),
                  },
                  { header: 'Instrutor', cell: (lesson) => lesson.instructor?.full_name ?? '—' },
                  { header: 'Veículo', cell: (lesson) => lesson.vehicle?.plate ?? '—' },
                  { header: 'Situação', cell: (lesson) => <LessonStatusBadge status={lesson.status} /> },
                  {
                    header: 'Ações',
                    actions: true,
                    cell: (lesson, { mobile }) =>
                      lesson.status === 'scheduled' && (
                        <Button
                          variant="outline-success"
                          size={mobile ? undefined : 'sm'}
                          className={mobile ? 'flex-fill' : undefined}
                          disabled={practiceBlocked || (complete.isPending && complete.variables === lesson.id)}
                          title={practiceBlocked ? 'Bloqueada: o checklist de liberação para a prática está incompleto.' : undefined}
                          onClick={() => complete.mutate(lesson.id, { onSuccess: () => notify.success('Aula concluída.') })}
                        >
                          <i className={`bi ${practiceBlocked ? 'bi-lock-fill' : 'bi-check2'} me-1`} aria-hidden="true" />
                          Concluir aula
                        </Button>
                      ),
                  },
                ]}
              />
              {practiceBlocked && data.data.some((lesson) => lesson.status === 'scheduled') && (
                <p className="small text-secondary">Aulas agendadas só podem ser concluídas depois da liberação para a prática.</p>
              )}
            </>
          )}
        </QueryState>
      </section>
      {editing && <EnrollmentEditModal organization={organization} enrollment={enrollment} onClose={() => setEditing(false)} />}
    </>
  )
}
