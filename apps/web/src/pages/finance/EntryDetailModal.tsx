import { useState } from 'react'
import { Alert, Badge, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { QueryState } from '../../components/QueryState'
import { ReasonModal } from '../../components/ReasonModal'
import { DOCUMENT_TYPE_LABELS } from '../../config/domain'
import { organizationPaths } from '../../config/paths'
import { useCancelEntry, useCancelInstallment, useConfirmPayment, useEntry, useReversePayment, useUpdateInstallment } from '../../hooks/useFinance'
import { useDocumentFile } from '../../hooks/useDocuments'
import { useEntryDocuments } from '../../hooks/useStudentHistory'
import type { Installment, Payment } from '../../types/finance'
import { formatDate } from '../../utils/formatDate'
import { toCents, toReais } from '../../utils/money'
import { todayInTimeZone } from '../../utils/timezone'
import { UploadDocumentModal } from '../students/UploadDocumentModal'
import { EntryFormModal } from './EntryFormModal'
import { PayModal } from './PayModal'
import { Money, SituationBadge } from './shared'

type Props = { organizationId: number; timezone: string; entryId: number; canManage: boolean; onClose: () => void }

// Lançamento completo: parcelas, pagamentos, anexos e as providências de cada um (receber, estornar, corrigir, cancelar)
export function EntryDetailModal({ organizationId, timezone, entryId, canManage, onClose }: Props) {
  const links = organizationPaths(organizationId)
  const query = useEntry(organizationId, entryId)
  const documents = useEntryDocuments(organizationId, entryId)
  const file = useDocumentFile(organizationId)
  const confirmPayment = useConfirmPayment(organizationId)
  const reverse = useReversePayment(organizationId)
  const cancelInstallment = useCancelInstallment(organizationId)
  const cancelEntry = useCancelEntry(organizationId)
  const update = useUpdateInstallment(organizationId)
  const [paying, setPaying] = useState<Installment | null>(null)
  const [editing, setEditing] = useState<{ installment: Installment; due: string; amount: string } | null>(null)
  const [reversing, setReversing] = useState<Payment | null>(null)
  const [cancellingInstallment, setCancellingInstallment] = useState<Installment | null>(null)
  const [cancellingEntry, setCancellingEntry] = useState(false)
  const [repeating, setRepeating] = useState(false)
  const [attaching, setAttaching] = useState<Payment | 'entry' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const today = todayInTimeZone(timezone)

  return (
    <>
      <Modal show={!paying && !attaching} onHide={onClose} centered size="xl" fullscreen="lg-down">
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5">
            Lançamento
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <QueryState query={query} isEmpty={() => false} empty={null}>
            {(entry) => {
              const receivable = entry.type === 'receivable'
              const who = entry.partner?.name ?? entry.student?.name ?? entry.party?.name
              return (
                <>
                  <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
                    <div>
                      <h3 className="h5 mb-1 text-break">{entry.description}</h3>
                      <div className="text-secondary">
                        {receivable ? 'Receita' : 'Despesa'} · {entry.category.name}
                        {who && <> · {receivable ? 'pagador' : 'favorecido'}: <strong>{who}</strong></>}
                        {entry.partner && entry.student && <> · aluno: {entry.student.name}</>}
                      </div>
                      <div className="small text-secondary">
                        Lançado em {formatDate(entry.issued_on)}
                        {entry.created_by && <> por {entry.created_by.name}</>}
                        {entry.enrollment_id && <> · <Link to={links.enrollment(entry.enrollment_id)}>matrícula</Link></>}
                        {entry.category.is_pass_through && <> · <Badge bg="info">Repasse/reembolso: fora do faturamento</Badge></>}
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="small text-secondary">Total</div>
                      <Money cents={entry.total_cents} strong />
                      <div className="small text-secondary">Pago <Money cents={entry.paid_cents} tone="success" /> · falta <Money cents={entry.outstanding_cents} /></div>
                    </div>
                  </div>

                  {entry.status === 'cancelled' && (
                    <Alert variant="secondary">
                      Lançamento cancelado{entry.cancel_reason ? `: ${entry.cancel_reason}` : '.'}
                    </Alert>
                  )}
                  {error && (
                    <Alert variant="danger" dismissible onClose={() => setError(null)} role="alert">
                      {error}
                    </Alert>
                  )}

                  {entry.installments.map((installment) => (
                    <div key={installment.id} className="border rounded p-3 mb-3">
                      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                        <div>
                          <strong>Parcela {installment.number}/{entry.installments_count}</strong> · vence em {formatDate(installment.due_date)} <SituationBadge situation={installment.situation} />
                          <div className="small text-secondary">
                            Valor <Money cents={installment.amount_cents} /> · pago <Money cents={installment.paid_cents} /> · falta <Money cents={installment.outstanding_cents} strong />
                          </div>
                        </div>
                        {entry.status === 'active' && installment.status !== 'cancelled' && (
                          <div className="d-flex flex-wrap gap-2">
                            {installment.outstanding_cents > 0 && (
                              <Button size="sm" onClick={() => setPaying({ ...installment, entry })}>
                                {receivable ? 'Receber' : 'Pagar'}
                              </Button>
                            )}
                            {(installment.payments ?? []).every((p) => p.status === 'reversed') && (
                              <>
                                <Button size="sm" variant="outline-secondary" onClick={() => setEditing({ installment, due: installment.due_date, amount: toReais(installment.amount_cents) })}>
                                  Corrigir
                                </Button>
                                {canManage && (
                                  <Button size="sm" variant="outline-danger" onClick={() => setCancellingInstallment(installment)}>
                                    Cancelar parcela
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {editing?.installment.id === installment.id && (
                        <Row className="g-2 mt-1 align-items-end">
                          <Col sm={4}>
                            <Form.Label htmlFor="edit-due" className="small mb-1">Vencimento</Form.Label>
                            <Form.Control id="edit-due" type="date" value={editing.due} onChange={(event) => setEditing({ ...editing, due: event.target.value })} />
                          </Col>
                          <Col sm={4}>
                            <Form.Label htmlFor="edit-amount" className="small mb-1">Valor (R$)</Form.Label>
                            <Form.Control id="edit-amount" inputMode="decimal" value={editing.amount} onChange={(event) => setEditing({ ...editing, amount: event.target.value.replace(',', '.') })} />
                          </Col>
                          <Col sm={4} className="d-flex gap-2">
                            <Button
                              disabled={update.isPending}
                              onClick={() =>
                                update.mutate(
                                  { installmentId: installment.id, due_date: editing.due, amount_cents: toCents(editing.amount) },
                                  { onSuccess: () => setEditing(null), onError: (e) => setError(e.message) },
                                )
                              }
                            >
                              Salvar
                            </Button>
                            <Button variant="link" onClick={() => setEditing(null)}>
                              Cancelar
                            </Button>
                          </Col>
                        </Row>
                      )}

                      {(installment.payments ?? []).length > 0 && (
                        <div className="table-responsive mt-3">
                          <Table size="sm" className="align-middle mb-0">
                            <thead>
                              <tr>
                                <th scope="col">Data</th>
                                <th scope="col">Forma e conta</th>
                                <th scope="col">Valor</th>
                                <th scope="col">Situação</th>
                                <th scope="col" className="text-end"><span className="visually-hidden">Ações</span></th>
                              </tr>
                            </thead>
                            <tbody>
                              {(installment.payments ?? []).map((payment) => (
                                <tr key={payment.id} className={payment.status === 'reversed' ? 'text-secondary' : undefined}>
                                  <td className="tabular-nums">{formatDate(payment.paid_on)}</td>
                                  <td>
                                    {payment.method.name} · {payment.account.name}
                                    {payment.reference && <span className="d-block small text-secondary text-break">{payment.reference}</span>}
                                  </td>
                                  <td>
                                    <Money cents={payment.applied_cents} />
                                    {(payment.discount_cents > 0 || payment.interest_cents > 0 || payment.fine_cents > 0 || payment.fee_cents > 0) && (
                                      <span className="d-block small text-secondary">
                                        {payment.discount_cents > 0 && <>desconto <Money cents={payment.discount_cents} /> </>}
                                        {payment.interest_cents > 0 && <>juros <Money cents={payment.interest_cents} /> </>}
                                        {payment.fine_cents > 0 && <>multa <Money cents={payment.fine_cents} /> </>}
                                        {payment.fee_cents > 0 && <>taxa <Money cents={payment.fee_cents} /> </>}
                                        {payment.adjust_reason && <>({payment.adjust_reason})</>}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    {payment.status === 'confirmed' && <Badge bg="success">Confirmado</Badge>}
                                    {payment.status === 'pending' && (
                                      <Badge bg="warning" text="dark">
                                        Aguarda liquidação{payment.expected_on ? ` até ${formatDate(payment.expected_on)}` : ''}
                                      </Badge>
                                    )}
                                    {payment.status === 'reversed' && (
                                      <Badge bg="secondary" title={payment.reverse_reason ?? undefined}>
                                        Estornado
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="text-end">
                                    <div className="d-inline-flex flex-wrap gap-1 justify-content-end">
                                      {payment.status === 'pending' && (
                                        <Button size="sm" variant="success" disabled={confirmPayment.isPending} onClick={() => confirmPayment.mutate({ paymentId: payment.id, settledOn: today }, { onError: (e) => setError(e.message) })}>
                                          Confirmar liquidação
                                        </Button>
                                      )}
                                      {payment.status !== 'reversed' && (
                                        <Link to={links.financeReceipt(payment.id)} className="btn btn-sm btn-outline-secondary">
                                          Recibo
                                        </Link>
                                      )}
                                      {payment.status !== 'reversed' && (
                                        <Button size="sm" variant="outline-secondary" onClick={() => setAttaching(payment)}>
                                          Anexar
                                        </Button>
                                      )}
                                      {canManage && payment.status !== 'reversed' && (
                                        <Button size="sm" variant="outline-danger" onClick={() => setReversing(payment)}>
                                          Estornar
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                      )}
                    </div>
                  ))}

                  <section aria-labelledby="entry-docs" className="mb-2">
                    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                      <h3 id="entry-docs" className="h6 mb-0">Anexos privados</h3>
                      <Button size="sm" variant="outline-primary" onClick={() => setAttaching('entry')}>
                        <i className="bi bi-paperclip me-1" aria-hidden="true" />
                        Anexar contrato ou comprovante
                      </Button>
                    </div>
                    {documents.data && documents.data.data.length === 0 ? (
                      <p className="small text-secondary mb-0">Nenhum anexo.</p>
                    ) : (
                      <ul className="list-unstyled mb-0 d-grid gap-1">
                        {documents.data?.data.map((doc) => (
                          <li key={doc.id} className="d-flex flex-wrap justify-content-between gap-2">
                            <span className="text-break">{DOCUMENT_TYPE_LABELS[doc.type]} · {doc.original_name}</span>
                            <Button size="sm" variant="link" className="p-0" disabled={file.isPending} onClick={() => file.mutate({ document: doc, mode: 'view', tab: window.open('', '_blank') })}>
                              Ver
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <div className="mt-3">
                    <Button variant="outline-secondary" size="sm" onClick={() => setRepeating(true)}>
                      <i className="bi bi-copy me-1" aria-hidden="true" />
                      Repetir este lançamento
                    </Button>
                  </div>
                  {repeating && <EntryFormModal organizationId={organizationId} timezone={timezone} type={entry.type} copyFrom={entry} onClose={() => { setRepeating(false); onClose() }} />}
                  {canManage && entry.status === 'active' && entry.paid_cents === 0 && (
                    <div className="mt-3">
                      <Button variant="outline-danger" size="sm" onClick={() => setCancellingEntry(true)}>
                        Cancelar lançamento
                      </Button>
                    </div>
                  )}
                  {canManage && entry.status === 'active' && entry.paid_cents > 0 && (
                    <p className="small text-secondary mt-3 mb-0">Para cancelar um lançamento com pagamentos, estorne os pagamentos antes: o que já entrou não é apagado.</p>
                  )}
                </>
              )
            }}
          </QueryState>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={onClose}>Fechar</Button>
        </Modal.Footer>
      </Modal>

      {paying && <PayModal organizationId={organizationId} timezone={timezone} installment={paying} onClose={() => setPaying(null)} />}
      {attaching && (
        <UploadDocumentModal
          organizationId={organizationId}
          owner={{ finance_entry_id: entryId, ...(attaching !== 'entry' ? { finance_payment_id: attaching.id } : {}) }}
          defaultType={attaching === 'entry' ? 'contract' : 'payment_proof'}
          title={attaching === 'entry' ? 'Anexar ao lançamento' : 'Anexar ao pagamento'}
          onClose={() => setAttaching(null)}
        />
      )}
      {reversing && (
        <ReasonModal
          title="Estornar pagamento"
          description="O valor sai da conta e a parcela volta a ficar em aberto. O lançamento original continua no extrato, com o estorno ao lado."
          label="Motivo do estorno"
          submitLabel="Estornar"
          singleLine
          pending={reverse.isPending}
          error={reverse.error}
          onSubmit={(reason) => reverse.mutate({ paymentId: reversing.id, reason }, { onSuccess: () => setReversing(null) })}
          onClose={() => setReversing(null)}
        />
      )}
      {cancellingInstallment && (
        <ReasonModal
          title={`Cancelar parcela ${cancellingInstallment.number}`}
          label="Motivo"
          submitLabel="Cancelar parcela"
          singleLine
          pending={cancelInstallment.isPending}
          error={cancelInstallment.error}
          onSubmit={(reason) => cancelInstallment.mutate({ installmentId: cancellingInstallment.id, reason }, { onSuccess: () => setCancellingInstallment(null) })}
          onClose={() => setCancellingInstallment(null)}
        />
      )}
      {cancellingEntry && (
        <ReasonModal
          title="Cancelar lançamento"
          description="Todas as parcelas em aberto são canceladas. O histórico fica registrado."
          label="Motivo"
          submitLabel="Cancelar lançamento"
          singleLine
          pending={cancelEntry.isPending}
          error={cancelEntry.error}
          onSubmit={(reason) => cancelEntry.mutate({ entryId, reason }, { onSuccess: () => setCancellingEntry(false) })}
          onClose={() => setCancellingEntry(false)}
        />
      )}
    </>
  )
}
