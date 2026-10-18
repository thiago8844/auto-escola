import { useState } from 'react'
import { Alert, Button, Card, ListGroup } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { ExamStatusBadge } from '../../components/StatusBadges'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useExam, useExams } from '../../hooks/useExams'
import type { Exam } from '../../types/exam'
import { formatDateTime } from '../../utils/formatDateTime'
import { canOperate } from '../../utils/permissions'
import { EditExamModal, ExamResultModal, RescheduleExamModal } from './ExamActionModals'
import { ExamAttachments } from './ExamAttachments'
import { FeesPanel } from './FeesPanel'

export default function ExamDetailPage() {
  const { examId = '' } = useParams()
  const organization = useActiveOrganization()
  const query = useExam(organization.id, examId)

  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(exam) => <ExamDetail exam={exam} />}
    </QueryState>
  )
}

function ExamDetail({ exam }: { exam: Exam }) {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const staff = canOperate(organization.role)
  const canCorrect = organization.role === 'owner' || organization.role === 'admin'
  const [modal, setModal] = useState<'reschedule' | 'result' | 'correct' | 'edit' | null>(null)
  const processId = exam.qualification_process_id
  const siblings = useExams(organization.id, { page: 1, perPage: 100, processId }, staff && processId !== undefined)
  const tz = organization.timezone
  const scheduled = exam.status === 'scheduled'

  return (
    <>
      <PageHeader
        title={`Exame ${exam.category} · tentativa ${exam.attempt_number}`}
        subtitle={exam.student && (staff ? <Link to={links.student(exam.student.id)}>{exam.student.name}</Link> : exam.student.name)}
        actions={
          <>
            <ExamStatusBadge status={exam.status} />
            {staff && scheduled && (
              <>
                <Button size="sm" onClick={() => setModal('result')}>
                  <i className="bi bi-clipboard-check me-1" aria-hidden="true" />
                  Registrar resultado
                </Button>
                <Button size="sm" variant="outline-primary" onClick={() => setModal('reschedule')}>
                  Remarcar
                </Button>
              </>
            )}
            {staff && !scheduled && exam.status !== 'cancelled' && canCorrect && (
              <Button size="sm" variant="outline-warning" onClick={() => setModal('correct')}>
                Corrigir resultado
              </Button>
            )}
            {staff && (
              <Button size="sm" variant="outline-secondary" onClick={() => setModal('edit')}>
                Editar dados
              </Button>
            )}
          </>
        }
      />

      {exam.pending && exam.pending.length > 0 && (
        <Alert variant="warning">
          <p className="fw-semibold mb-1">
            <i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />
            Pendências para este exame
          </p>
          <ul className="mb-1">
            {exam.pending.map((item) => (
              <li key={item.code}>{item.message}</li>
            ))}
          </ul>
          <p className="small mb-0">São avisos de conferência interna. O sistema não define mínimo de aulas, prazo de reteste nem reconhecimento oficial.</p>
        </Alert>
      )}

      <Card className="mb-4">
        <Card.Body>
          <dl className="row mb-0">
            <dt className="col-sm-4 col-md-3">Data e hora</dt>
            <dd className="col-sm-8 col-md-9 tabular-nums">
              {formatDateTime(exam.scheduled_at, tz)} · {exam.duration_minutes} min
              {(exam.reschedule_count ?? 0) > 0 && <span className="text-secondary"> (remarcado {exam.reschedule_count}×)</span>}
            </dd>
            <dt className="col-sm-4 col-md-3">Local</dt>
            <dd className="col-sm-8 col-md-9">{exam.location ?? '—'}</dd>
            <dt className="col-sm-4 col-md-3">Instrutor responsável</dt>
            <dd className="col-sm-8 col-md-9">{exam.instructor?.full_name ?? '—'}</dd>
            <dt className="col-sm-4 col-md-3">Veículo</dt>
            <dd className="col-sm-8 col-md-9">{exam.vehicle ? `${exam.vehicle.plate} · ${exam.vehicle.model}` : '—'}</dd>
            {staff && (
              <>
                <dt className="col-sm-4 col-md-3">Protocolo</dt>
                <dd className="col-sm-8 col-md-9 text-break">{exam.protocol ?? '—'}</dd>
                <dt className="col-sm-4 col-md-3">Resultado</dt>
                <dd className="col-sm-8 col-md-9">
                  <ExamStatusBadge status={exam.status} />
                  {exam.result_at && <span className="text-secondary small ms-2">em {formatDateTime(exam.result_at, tz)}</span>}
                  {exam.status_reason && <span className="d-block small text-secondary mt-1">{exam.status_reason}</span>}
                </dd>
                <dt className="col-sm-4 col-md-3">Observações</dt>
                <dd className="col-sm-8 col-md-9 mb-0 text-break">{exam.notes ?? '—'}</dd>
              </>
            )}
          </dl>
        </Card.Body>
      </Card>

      {staff && (exam.schedule_history?.length ?? 0) > 0 && (
        <section className="mb-4" aria-labelledby="history-title">
          <h2 id="history-title" className="h4 mb-3">
            Histórico de remarcações
          </h2>
          <ListGroup>
            {exam.schedule_history!.map((change, index) => (
              <ListGroup.Item key={change.changed_at}>
                <span className="fw-semibold tabular-nums">{formatDateTime(change.scheduled_at, tz)}</span>
                {change.location && ` · ${change.location}`}
                <span className="d-block small text-secondary">
                  Substituído em {formatDateTime(change.changed_at, tz)}
                  {change.reason ? ` — ${change.reason}` : ''} (remarcação {index + 1})
                </span>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </section>
      )}

      {staff && processId !== undefined && (
        <>
          <FeesPanel organizationId={organization.id} timezone={tz} processId={processId} exams={siblings.data?.data ?? [exam]} examId={exam.id} />
          <ExamAttachments organizationId={organization.id} examId={exam.id} processId={processId} />
          <p>
            <Link to={links.process(processId)}>
              <i className="bi bi-diagram-3 me-1" aria-hidden="true" />
              Ver processo, desfecho e linha do tempo
            </Link>
          </p>
        </>
      )}

      {modal === 'reschedule' && <RescheduleExamModal organizationId={organization.id} timezone={tz} exam={exam} onClose={() => setModal(null)} />}
      {(modal === 'result' || modal === 'correct') && <ExamResultModal organizationId={organization.id} exam={exam} correction={modal === 'correct'} onClose={() => setModal(null)} />}
      {modal === 'edit' && <EditExamModal organizationId={organization.id} exam={exam} onClose={() => setModal(null)} />}
    </>
  )
}
