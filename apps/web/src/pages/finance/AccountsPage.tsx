import { useState } from 'react'
import { Alert, Badge, Button, Card, Col, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { organizationPaths } from '../../config/paths'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { ReasonModal } from '../../components/ReasonModal'
import { MOVEMENT_KIND } from '../../config/finance'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useAccounts, useConsolidated, useExportCsv, useReverseTransfer, useStatement, useTransfers } from '../../hooks/useFinance'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import { useUrlFilters } from '../../hooks/useUrlFilters'
import type { FinanceAccount, Transfer } from '../../types/finance'
import { formatDate } from '../../utils/formatDate'
import { formatCents } from '../../utils/money'
import { canManageMembers } from '../../utils/permissions'
import { todayInTimeZone } from '../../utils/timezone'
import { PeriodFilter, Stat } from '../reports/ReportFilters'
import { AccountFormModal, AdjustModal, ReconcileModal, TransferModal } from './AccountModals'
import { Money } from './shared'

// Contas, extrato por conta, saldo consolidado, transferências e conferência com o extrato do banco
export default function AccountsPage() {
  const organization = useActiveOrganization()
  const manage = canManageMembers(organization.role)
  const links = organizationPaths(organization.id)
  const today = todayInTimeZone(organization.timezone)
  const { values, set, setMany } = useUrlFilters(['conta', 'de', 'ate'] as const)
  const from = values.de || `${today.slice(0, 7)}-01`
  const to = values.ate || today
  const accounts = useAccounts(organization.id)
  const selectedId = values.conta ? Number(values.conta) : null
  const statement = useStatement(organization.id, selectedId, { from, to })
  const consolidated = useConsolidated(organization.id, { from, to })
  const exportCsv = useExportCsv(organization.id)
  const [page, setPage] = usePageParam()
  const transfers = useTransfers(organization.id, page)
  useClampPage(page, transfers.data?.meta.last_page, setPage)
  const reverseTransfer = useReverseTransfer(organization.id)
  const [modal, setModal] = useState<null | { kind: 'new' } | { kind: 'edit' | 'adjust' | 'reconcile'; account: FinanceAccount } | { kind: 'transfer' }>(null)
  const [reversing, setReversing] = useState<Transfer | null>(null)
  const account = accounts.data?.find((a) => a.id === selectedId)

  return (
    <>
      <PageHeader
        title="Contas e movimentações"
        subtitle="Banco e caixa: saldo, extrato e transferências. Forma de pagamento (Pix, dinheiro…) e conta são coisas diferentes."
        actions={
          manage && (
            <>
              <Button variant="outline-primary" onClick={() => setModal({ kind: 'transfer' })} disabled={(accounts.data?.filter((a) => a.active).length ?? 0) < 2}>
                <i className="bi bi-arrow-left-right me-2" aria-hidden="true" />
                Transferir
              </Button>
              <Button onClick={() => setModal({ kind: 'new' })}>
                <i className="bi bi-plus-lg me-2" aria-hidden="true" />
                Nova conta ou caixa
              </Button>
            </>
          )
        }
      />

      <QueryState query={accounts} isEmpty={(d) => d.length === 0} empty={manage ? 'Nenhuma conta ainda. Use “Nova conta ou caixa” para cadastrar o banco e o caixa com o saldo inicial.' : 'Nenhuma conta cadastrada. Peça a um gestor para cadastrar.'}>
        {(data) => (
          <Row xs={1} md={2} xl={3} className="g-3 mb-4">
            {data.map((a) => (
              <Col key={a.id}>
                <Card className={`h-100 ${a.id === selectedId ? 'border-primary' : ''}`}>
                  <Card.Body>
                    <div className="d-flex justify-content-between gap-2">
                      <Card.Title as="h2" className="h6 text-break">
                        <i className={`bi ${a.kind === 'cash' ? 'bi-cash-stack' : 'bi-bank'} me-2`} aria-hidden="true" />
                        {a.name}
                        {!a.active && <Badge bg="secondary" className="ms-2">Inativa</Badge>}
                      </Card.Title>
                    </div>
                    <div className="fs-4 fw-semibold tabular-nums">{formatCents(a.balance_cents ?? 0)}</div>
                    <div className="small text-secondary mb-2">
                      Saldo inicial {formatCents(a.opening_balance_cents)} em {formatDate(a.opening_date)}
                      {a.institution && <> · {a.institution}</>}
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      <Button size="sm" variant={a.id === selectedId ? 'primary' : 'outline-primary'} onClick={() => set('conta', a.id === selectedId ? '' : String(a.id))}>
                        Ver extrato
                      </Button>
                      {manage && (
                        <>
                          <Button size="sm" variant="outline-secondary" onClick={() => setModal({ kind: 'adjust', account: a })}>Ajustar saldo</Button>
                          <Button size="sm" variant="outline-secondary" onClick={() => setModal({ kind: 'edit', account: a })}>Editar</Button>
                        </>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </QueryState>

      <PeriodFilter timezone={organization.timezone} from={from} to={to} onChange={(start, end) => setMany({ de: start, ate: end })} />

      {selectedId === null ? (
        <QueryState query={consolidated} isEmpty={(d) => d.accounts.length === 0} empty={null}>
          {(data) => (
            <section aria-labelledby="consolidated-title" className="mb-4">
              <h2 id="consolidated-title" className="h5">Consolidado de todas as contas</h2>
              <Row className="g-3 mb-2">
                <Col xs={6} lg={3}><Stat label="Saldo inicial do período" value={formatCents(data.opening_balance_cents)} /></Col>
                <Col xs={6} lg={3}><Stat label="Entradas reais" value={formatCents(data.total_in_cents)} /></Col>
                <Col xs={6} lg={3}><Stat label="Saídas reais" value={formatCents(data.total_out_cents)} /></Col>
                <Col xs={6} lg={3}><Stat label="Saldo final" value={formatCents(data.closing_balance_cents)} /></Col>
              </Row>
              <p className="small text-secondary">
                Saldo inicial + entradas − saídas = saldo final. Transferências entre contas ({formatCents(data.transfers_cents)} no período) se anulam e não entram como faturamento nem despesa.
              </p>
            </section>
          )}
        </QueryState>
      ) : (
        <QueryState query={statement} isEmpty={() => false} empty={null}>
          {(data) => (
            <section aria-labelledby="statement-title" className="mb-4">
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                <h2 id="statement-title" className="h5 mb-0">Extrato: {data.account.name}</h2>
                <div className="d-flex flex-wrap gap-2">
                  <Button size="sm" variant="outline-secondary" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate({ what: 'movements', params: { account_id: data.account.id, from, to } })}>
                    <i className="bi bi-filetype-csv me-1" aria-hidden="true" />
                    CSV
                  </Button>
                  {manage && account && (
                    <Button size="sm" variant="outline-primary" onClick={() => setModal({ kind: 'reconcile', account })}>
                      Conferir com o extrato do banco
                    </Button>
                  )}
                </div>
              </div>
              <Row className="g-3 mb-3">
                <Col xs={6} lg={3}><Stat label="Saldo de abertura" value={formatCents(data.opening_balance_cents)} /></Col>
                <Col xs={6} lg={3}><Stat label="Entradas" value={formatCents(data.total_in_cents)} /></Col>
                <Col xs={6} lg={3}><Stat label="Saídas" value={formatCents(data.total_out_cents)} /></Col>
                <Col xs={6} lg={3}><Stat label="Saldo final" value={formatCents(data.closing_balance_cents)} /></Col>
              </Row>
              {data.lines.length === 0 ? (
                <Alert variant="info">Nenhuma movimentação neste período.</Alert>
              ) : (
                <div className="table-responsive">
                  <Table size="sm" className="align-middle">
                    <thead>
                      <tr>
                        <th scope="col">Data</th>
                        <th scope="col">Movimento</th>
                        <th scope="col" className="text-end">Valor</th>
                        <th scope="col" className="text-end">Saldo</th>
                        <th scope="col"><span className="visually-hidden">Conferido</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lines.map((line) => (
                        <tr key={line.id}>
                          <td className="tabular-nums">{formatDate(line.date)}</td>
                          <td>
                            <i className={`bi ${MOVEMENT_KIND[line.kind]?.icon ?? 'bi-dot'} me-1`} aria-hidden="true" />
                            {line.description}
                            <span className="d-block small text-secondary">{MOVEMENT_KIND[line.kind]?.label ?? line.kind}</span>
                          </td>
                          <td className={`text-end tabular-nums ${line.direction === 'in' ? 'text-success' : ''}`}>
                            <span className="visually-hidden">{line.direction === 'in' ? 'Entrada ' : 'Saída '}</span>
                            {line.direction === 'in' ? '+' : '−'}{formatCents(line.amount_cents)}
                          </td>
                          <td className="text-end tabular-nums">{formatCents(line.balance_cents)}</td>
                          <td>{line.reconciled && <i className="bi bi-patch-check-fill text-success" title="Conferido com o extrato" aria-label="Conferido" />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </section>
          )}
        </QueryState>
      )}

      <section aria-labelledby="transfers-title">
        <h2 id="transfers-title" className="h5">Transferências</h2>
        <QueryState query={transfers} isEmpty={(d) => d.data.length === 0} empty="Nenhuma transferência registrada.">
          {(data) => (
            <>
              <ul className="list-unstyled d-grid gap-2">
                {data.data.map((t) => (
                  <li key={t.id} className="d-flex flex-wrap justify-content-between align-items-center gap-2 border-bottom pb-2">
                    <div className={t.reversed_at ? 'text-secondary text-decoration-line-through' : undefined}>
                      <span className="tabular-nums">{formatDate(t.occurred_on)}</span> · {t.from_account.name} → {t.to_account.name} · <Money cents={t.amount_cents} strong />
                      <div className="small text-secondary">{t.reason}</div>
                    </div>
                    {t.reversed_at ? <Badge bg="secondary">Estornada</Badge> : manage && <Button size="sm" variant="outline-danger" onClick={() => setReversing(t)}>Estornar</Button>}
                  </li>
                ))}
              </ul>
              <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={10} onPageChange={setPage} />
            </>
          )}
        </QueryState>
      </section>

      <p className="small mt-3">
        Para lançar cobranças e despesas, use <Link to={links.financeReceivables}>Receitas</Link> e <Link to={links.financePayables}>Despesas</Link>.
      </p>

      {modal?.kind === 'new' && <AccountFormModal organizationId={organization.id} timezone={organization.timezone} onClose={() => setModal(null)} />}
      {modal?.kind === 'edit' && <AccountFormModal organizationId={organization.id} timezone={organization.timezone} account={modal.account} onClose={() => setModal(null)} />}
      {modal?.kind === 'adjust' && <AdjustModal organizationId={organization.id} timezone={organization.timezone} account={modal.account} onClose={() => setModal(null)} />}
      {modal?.kind === 'transfer' && <TransferModal organizationId={organization.id} timezone={organization.timezone} accounts={accounts.data ?? []} onClose={() => setModal(null)} />}
      {modal?.kind === 'reconcile' && <ReconcileModal organizationId={organization.id} timezone={organization.timezone} account={modal.account} statement={statement.data} onClose={() => setModal(null)} />}
      {reversing && (
        <ReasonModal
          title="Estornar transferência"
          description="As duas pontas voltam juntas: o valor retorna à conta de origem e sai da de destino. O original fica no extrato."
          label="Motivo"
          submitLabel="Estornar"
          singleLine
          pending={reverseTransfer.isPending}
          error={reverseTransfer.error}
          onSubmit={(reason) => reverseTransfer.mutate({ transferId: reversing.id, reason }, { onSuccess: () => setReversing(null) })}
          onClose={() => setReversing(null)}
        />
      )}
    </>
  )
}
