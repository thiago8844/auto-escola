import { useState } from 'react'
import { Alert, Button, Card, Col, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { ReasonModal } from '../../components/ReasonModal'
import { CategoryResultBadge, IssuanceStatusBadge } from '../../components/StatusBadges'
import { CLOSURE_KIND_LABELS, ISSUANCE_KIND_LABELS } from '../../config/domain'
import { organizationPaths } from '../../config/paths'
import { useConfirmRenunciation, useReopenProcess, useRenounce, useRevertRenunciation } from '../../hooks/useOutcome'
import type { CategoryOutcome } from '../../types/outcome'
import type { QualificationProcess } from '../../types/process'
import { formatDate } from '../../utils/formatDate'
import { CloseProcessModal, IssuanceModal } from './OutcomeModals'

type OutcomePanelProps = { organizationId: number; timezone: string; process: QualificationProcess; canReopen: boolean; onScheduleExam: () => void }

type Dialog =
  | { kind: 'issuance' }
  | { kind: 'close' }
  | { kind: 'reopen' }
  | { kind: 'renounce' | 'confirm' | 'revert'; category: string }
  | null

// Desfecho do processo em eixos separados: liberação, resultado por categoria, emissão e encerramento
export function OutcomePanel({ organizationId, timezone, process, canReopen, onScheduleExam }: OutcomePanelProps) {
  const outcome = process.outcome!
  const links = organizationPaths(organizationId)
  const [dialog, setDialog] = useState<Dialog>(null)
  const id = String(process.id)
  const reopen = useReopenProcess(organizationId, id)
  const renounce = useRenounce(organizationId, id)
  const confirm = useConfirmRenunciation(organizationId, id)
  const revert = useRevertRenunciation(organizationId, id)
  const closed = process.status === 'completed' || process.status === 'closed'
  const anyApproved = outcome.categories.some((c) => c.result === 'approved')
  const done = () => setDialog(null)

  return (
    <section aria-labelledby="outcome-title" className="mb-5">
      <h2 id="outcome-title" className="h4 mb-3">
        Desfecho do processo
      </h2>

      <Card className={`next-step mb-3 ${closed ? '' : 'border-primary-subtle'}`}>
        <Card.Body className="d-flex align-items-start gap-3">
          <i className={`bi ${closed ? 'bi-flag-fill text-success' : 'bi-signpost-split text-primary'} fs-3`} aria-hidden="true" />
          <div>
            <div className="small text-secondary text-uppercase fw-semibold">Próximo passo</div>
            <div className="fs-5">{outcome.next_step.label}</div>
          </div>
        </Card.Body>
      </Card>

      <Row className="g-3 mb-3">
        {outcome.categories.map((category) => (
          <Col key={category.category} md={outcome.categories.length > 1 ? 6 : 12}>
            <CategoryCard category={category} closed={closed} links={links} onSchedule={onScheduleExam} onDialog={(kind) => setDialog({ kind, category: category.category })} timezone={timezone} />
          </Col>
        ))}
      </Row>

      <Card className="mb-3">
        <Card.Body>
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
            <h3 className="h6 mb-0">Emissão do documento</h3>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <IssuanceStatusBadge status={outcome.issuance.status} />
              {!closed && (
                <Button size="sm" variant="outline-primary" disabled={!anyApproved} title={anyApproved ? undefined : 'Disponível após a aprovação em alguma categoria.'} onClick={() => setDialog({ kind: 'issuance' })}>
                  {outcome.issuance.status === 'not_started' ? 'Iniciar acompanhamento' : 'Atualizar emissão'}
                </Button>
              )}
            </div>
          </div>
          {outcome.issuance.awaiting && (
            <Alert variant="warning" className="small py-2">
              <i className="bi bi-hourglass-split me-2" aria-hidden="true" />
              Aprovado com emissão pendente: a aprovação não significa que o documento foi emitido.
            </Alert>
          )}
          {outcome.issuance.status !== 'not_started' && (
            <dl className="row small mb-0">
              {outcome.issuance.kind && (
                <>
                  <dt className="col-sm-4 col-md-3 fw-normal text-secondary">Modalidade</dt>
                  <dd className="col-sm-8 col-md-9">{ISSUANCE_KIND_LABELS[outcome.issuance.kind]}</dd>
                </>
              )}
              {outcome.issuance.reference && (
                <>
                  <dt className="col-sm-4 col-md-3 fw-normal text-secondary">Referência</dt>
                  <dd className="col-sm-8 col-md-9 text-break">{outcome.issuance.reference}</dd>
                </>
              )}
              {outcome.issuance.issued_at && (
                <>
                  <dt className="col-sm-4 col-md-3 fw-normal text-secondary">Emitido em</dt>
                  <dd className="col-sm-8 col-md-9">{formatDate(outcome.issuance.issued_at)}</dd>
                </>
              )}
              {outcome.issuance.delivered_at && (
                <>
                  <dt className="col-sm-4 col-md-3 fw-normal text-secondary">Entregue em</dt>
                  <dd className="col-sm-8 col-md-9">{formatDate(outcome.issuance.delivered_at)}</dd>
                </>
              )}
            </dl>
          )}
          {outcome.issuance.definitive_follow_up && (
            <p className="small mt-2 mb-0">
              <i className="bi bi-bell me-1" aria-hidden="true" />
              Acompanhar a futura definitiva{outcome.issuance.definitive_due_at ? ` até ${formatDate(outcome.issuance.definitive_due_at)}` : ''}. Notificação posterior: não impede concluir o processo.
            </p>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Body className="d-flex flex-wrap align-items-center justify-content-between gap-2">
          {closed ? (
            <>
              <div>
                <h3 className="h6 mb-1">
                  <i className="bi bi-lock-fill me-1" aria-hidden="true" />
                  {process.status === 'completed' ? 'Processo concluído' : 'Processo encerrado'}
                  {outcome.closure.kind && ` · ${CLOSURE_KIND_LABELS[outcome.closure.kind as keyof typeof CLOSURE_KIND_LABELS] ?? outcome.closure.kind}`}
                </h3>
                <p className="small text-secondary mb-0">
                  {outcome.closure.closed_at && `Em ${formatDate(outcome.closure.closed_at, timezone)}. `}
                  {outcome.closure.reason}
                </p>
              </div>
              {canReopen && (
                <Button variant="outline-warning" size="sm" onClick={() => setDialog({ kind: 'reopen' })}>
                  Reabrir processo
                </Button>
              )}
            </>
          ) : (
            <>
              <div>
                <h3 className="h6 mb-1">Encerrar acompanhamento</h3>
                <p className="small text-secondary mb-0">Conclua quando houver desfecho, ou registre desistência. Notificações e compromissos futuros são listados antes de confirmar.</p>
              </div>
              <Button variant="outline-secondary" size="sm" onClick={() => setDialog({ kind: 'close' })}>
                Concluir ou encerrar
              </Button>
            </>
          )}
        </Card.Body>
      </Card>

      {dialog?.kind === 'issuance' && <IssuanceModal organizationId={organizationId} process={process} onClose={done} />}
      {dialog?.kind === 'close' && <CloseProcessModal organizationId={organizationId} process={process} onClose={done} />}
      {dialog?.kind === 'reopen' && (
        <ReasonModal
          title="Reabrir processo"
          label="Motivo da reabertura"
          submitLabel="Reabrir"
          pending={reopen.isPending}
          error={reopen.error}
          onSubmit={(reason) => reopen.mutate(reason, { onSuccess: done })}
          onClose={done}
        />
      )}
      {dialog?.kind === 'renounce' && (
        <ReasonModal
          title={`Renunciar à categoria ${dialog.category}`}
          description={<span className="small text-secondary">O processo continua com as demais categorias. A confirmação da renúncia é registrada depois, separadamente.</span>}
          label="Motivo da renúncia"
          submitLabel="Registrar renúncia"
          pending={renounce.isPending}
          error={renounce.error}
          onSubmit={(reason) => renounce.mutate({ category: dialog.category, reason }, { onSuccess: done })}
          onClose={done}
        />
      )}
      {dialog?.kind === 'confirm' && (
        <ReasonModal
          title={`Confirmar renúncia à categoria ${dialog.category}`}
          label="Referência da confirmação"
          submitLabel="Confirmar"
          singleLine
          minLength={2}
          pending={confirm.isPending}
          error={confirm.error}
          onSubmit={(reference) => confirm.mutate({ category: dialog.category, reference }, { onSuccess: done })}
          onClose={done}
        />
      )}
      {dialog?.kind === 'revert' && (
        <ReasonModal
          title={`Desfazer renúncia à categoria ${dialog.category}`}
          label="Motivo"
          submitLabel="Desfazer renúncia"
          pending={revert.isPending}
          error={revert.error}
          onSubmit={(reason) => revert.mutate({ category: dialog.category, reason }, { onSuccess: done })}
          onClose={done}
        />
      )}
    </section>
  )
}

function CategoryCard({
  category,
  closed,
  links,
  timezone,
  onSchedule,
  onDialog,
}: {
  category: CategoryOutcome
  closed: boolean
  links: ReturnType<typeof organizationPaths>
  timezone: string
  onSchedule: () => void
  onDialog: (kind: 'renounce' | 'confirm' | 'revert') => void
}) {
  const needsExam = ['pending', 'failed', 'absent', 'incomplete'].includes(category.result)
  return (
    <Card className="h-100">
      <Card.Body>
        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
          <h3 className="h6 mb-0">Categoria {category.category}</h3>
          <CategoryResultBadge result={category.result} />
        </div>
        <p className="small text-secondary mb-2">
          {category.attempts === 0 ? 'Nenhuma tentativa de exame.' : `${category.attempts} tentativa(s) de exame.`}
          {category.last_exam_id && (
            <>
              {' '}
              <Link to={links.exam(category.last_exam_id)}>Ver última</Link>
            </>
          )}
        </p>
        {category.result === 'renounced' && (
          <p className="small mb-2">
            Renúncia registrada em {formatDate(category.renunciation.renounced_at!, timezone)}
            {category.renunciation.reason ? ` — ${category.renunciation.reason}` : ''}.{' '}
            {category.renunciation.confirmed_at ? (
              <span className="text-success">Confirmada em {formatDate(category.renunciation.confirmed_at, timezone)} ({category.renunciation.reference}).</span>
            ) : (
              <span className="text-warning-emphasis">Confirmação pendente.</span>
            )}
          </p>
        )}
        {!closed && (
          <div className="d-flex flex-wrap gap-2">
            {needsExam && (
              <Button size="sm" variant="outline-primary" onClick={onSchedule}>
                {category.attempts === 0 ? 'Agendar exame' : 'Nova tentativa'}
              </Button>
            )}
            {category.result !== 'approved' && category.result !== 'renounced' && category.result !== 'scheduled' && (
              <Button size="sm" variant="outline-secondary" onClick={() => onDialog('renounce')}>
                Renunciar
              </Button>
            )}
            {category.result === 'renounced' && !category.renunciation.confirmed_at && (
              <Button size="sm" variant="outline-success" onClick={() => onDialog('confirm')}>
                Confirmar renúncia
              </Button>
            )}
            {category.result === 'renounced' && (
              <Button size="sm" variant="link" onClick={() => onDialog('revert')}>
                Desfazer
              </Button>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
