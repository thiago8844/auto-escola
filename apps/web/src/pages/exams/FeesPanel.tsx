import { useState } from 'react'
import { Alert, Badge, Button } from 'react-bootstrap'
import { DataTable } from '../../components/DataTable'
import { QueryState } from '../../components/QueryState'
import { FeeStatusBadge } from '../../components/StatusBadges'
import { FEE_PARTY_LABELS, REIMBURSEMENT_LABELS } from '../../config/domain'
import { useDocumentFile } from '../../hooks/useDocuments'
import { useFees, useSettleReimbursement } from '../../hooks/useExams'
import type { Exam, ExternalFee } from '../../types/exam'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDate } from '../../utils/formatDate'
import { ChargeModal } from '../finance/ChargeModal'
import { FeeFormModal, FeeStatusModal } from './FeeModals'

type FeesPanelProps = { organizationId: number; timezone: string; processId: number; exams: Exam[]; examId?: number }

// Taxas externas do processo (ou da tentativa). Só a equipe vê; nunca viram receita.
export function FeesPanel({ organizationId, timezone, processId, exams, examId }: FeesPanelProps) {
  const query = useFees(organizationId, { page: 1, processId, examId })
  const settle = useSettleReimbursement(organizationId)
  const receipt = useDocumentFile(organizationId)
  const [editing, setEditing] = useState<ExternalFee | 'new' | null>(null)
  const [changing, setChanging] = useState<ExternalFee | null>(null)
  const [financing, setFinancing] = useState<{ fee: ExternalFee; kind: 'reimbursement' | 'advance' } | null>(null)

  return (
    <section aria-labelledby={`fees-title-${examId ?? 'p'}`} className="mb-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h2 id={`fees-title-${examId ?? 'p'}`} className="h4 mb-0">
          Taxas externas
        </h2>
        <Button size="sm" onClick={() => setEditing('new')}>
          <i className="bi bi-plus-lg me-1" aria-hidden="true" />
          Registrar taxa
        </Button>
      </div>

      <QueryState query={query} isEmpty={(d) => d.data.length === 0} empty="Nenhuma taxa externa registrada. Registre a guia para acompanhar o pagamento.">
        {(data) => (
          <>
            {data.data.some((fee) => fee.reimbursement === 'to_settle') && (
              <Alert variant="warning" className="small">
                <i className="bi bi-arrow-left-right me-2" aria-hidden="true" />
                Há taxa paga pelo espaço por conta de outra pessoa: o reembolso deve ser acertado no financeiro.
              </Alert>
            )}
            <DataTable
              rows={data.data}
              getKey={(fee) => fee.id}
              columns={[
                {
                  header: 'Taxa',
                  primary: true,
                  cell: (fee) => (
                    <>
                      {fee.kind}
                      {fee.voucher_number && <span className="d-block small text-secondary fw-normal">Guia {fee.voucher_number}</span>}
                      {(fee.exam_ids?.length ?? 0) > 1 && <Badge bg="body-secondary" text="body" className="border fw-normal mt-1">Compartilhada por {fee.exam_ids!.length} tentativas</Badge>}
                    </>
                  ),
                },
                { header: 'Valor', cell: (fee) => <span className="tabular-nums">{fee.amount_cents != null ? formatCurrency(fee.amount_cents / 100) : '—'}</span> },
                { header: 'Vencimento', cell: (fee) => <span className="tabular-nums">{fee.due_date ? formatDate(fee.due_date) : '—'}</span> },
                {
                  header: 'Situação',
                  cell: (fee) => (
                    <>
                      <FeeStatusBadge status={fee.status} />
                      {fee.confirmed_at && (
                        <span className="d-block small text-secondary mt-1">
                          Conferido por {fee.confirmed_by?.name ?? '—'} em {formatDate(fee.confirmed_at, timezone)}
                          {fee.receipt_document_id ? ' · com comprovante' : ''}
                        </span>
                      )}
                      {fee.status_reason && <span className="d-block small text-secondary mt-1">{fee.status_reason}</span>}
                    </>
                  ),
                },
                {
                  header: 'Quem paga',
                  cell: (fee) => (
                    <>
                      Deve: {FEE_PARTY_LABELS[fee.obligor]}
                      {fee.paid_by && <span className="d-block small text-secondary">Pagou: {FEE_PARTY_LABELS[fee.paid_by]}</span>}
                      {fee.reimbursement !== 'none' && (
                        <Badge bg={fee.reimbursement === 'to_settle' ? 'warning' : 'success'} className="mt-1">
                          {REIMBURSEMENT_LABELS[fee.reimbursement]}
                        </Badge>
                      )}
                    </>
                  ),
                },
                {
                  header: 'Ações',
                  actions: true,
                  cell: (fee, { mobile }) => (
                    <>
                      {fee.status !== 'cancelled' && (
                        <Button variant="outline-primary" size={mobile ? undefined : 'sm'} className={mobile ? 'flex-fill' : 'me-2'} onClick={() => setChanging(fee)}>
                          Situação
                        </Button>
                      )}
                      <Button variant="outline-secondary" size={mobile ? undefined : 'sm'} className={mobile ? 'flex-fill' : 'me-2'} onClick={() => setEditing(fee)}>
                        Editar
                      </Button>
                      {fee.receipt_document_id && (
                        <Button
                          variant="outline-secondary"
                          size={mobile ? undefined : 'sm'}
                          className={mobile ? 'flex-fill' : 'me-2'}
                          disabled={receipt.isPending}
                          onClick={() =>
                            receipt.mutate({ document: { id: fee.receipt_document_id!, original_name: 'comprovante' } as never, mode: 'view', tab: window.open('', '_blank') })
                          }
                        >
                          <i className="bi bi-paperclip me-1" aria-hidden="true" />
                          Comprovante
                        </Button>
                      )}
                      {fee.paid_by === 'organization' && fee.status !== 'cancelled' && (
                        <>
                          <Button variant="outline-primary" size={mobile ? undefined : 'sm'} className={mobile ? 'flex-fill' : 'me-2'} onClick={() => setFinancing({ fee, kind: 'advance' })}>
                            Lançar adiantamento
                          </Button>
                          <Button variant="outline-primary" size={mobile ? undefined : 'sm'} className={mobile ? 'flex-fill' : 'me-2'} onClick={() => setFinancing({ fee, kind: 'reimbursement' })}>
                            Cobrar reembolso
                          </Button>
                        </>
                      )}
                      {fee.reimbursement === 'to_settle' && (
                        <Button variant="outline-success" size={mobile ? undefined : 'sm'} className={mobile ? 'flex-fill' : undefined} disabled={settle.isPending} onClick={() => settle.mutate(fee.id)}>
                          Reembolso acertado
                        </Button>
                      )}
                    </>
                  ),
                },
              ]}
            />
          </>
        )}
      </QueryState>

      {editing && (
        <FeeFormModal
          organizationId={organizationId}
          processId={processId}
          fee={editing === 'new' ? undefined : editing}
          exams={exams}
          presetExamId={examId}
          onClose={() => setEditing(null)}
        />
      )}
      {financing && (
        <ChargeModal
          organizationId={organizationId}
          timezone={timezone}
          title={financing.kind === 'reimbursement' ? `Cobrar reembolso: ${financing.fee.kind}` : `Adiantamento: ${financing.fee.kind}`}
          path={`/external-fees/${financing.fee.id}/finance/${financing.kind}`}
          type={financing.kind === 'reimbursement' ? 'receivable' : 'payable'}
          description={
            financing.kind === 'reimbursement'
              ? 'O espaço pagou esta taxa por conta de outra pessoa: gera a cobrança do reembolso. É repasse, não receita de aula.'
              : 'Registra a saída do dinheiro que o espaço adiantou ao órgão oficial. É repasse, não despesa operacional.'
          }
          defaultTotalCents={financing.fee.amount_cents ?? null}
          defaultDue={financing.fee.due_date}
          withParty={financing.kind === 'advance'}
          onClose={() => setFinancing(null)}
        />
      )}
      {changing && <FeeStatusModal organizationId={organizationId} fee={changing} onClose={() => setChanging(null)} />}
    </section>
  )
}
