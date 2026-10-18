import { Alert, Card, Col, Form, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useBreakdown, useCashFlow, useOverview } from '../../hooks/useFinance'
import { useUrlFilters } from '../../hooks/useUrlFilters'
import { formatDate } from '../../utils/formatDate'
import { todayInTimeZone } from '../../utils/timezone'
import { PeriodFilter, Stat } from '../reports/ReportFilters'
import { formatCents } from '../../utils/money'
import { Money } from './shared'

// Visão geral: o que entrou e saiu de verdade, o que ainda vai entrar e sair e o saldo de cada conta
export default function OverviewPage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const today = todayInTimeZone(organization.timezone)
  const { values, setMany } = useUrlFilters(['de', 'ate', 'por', 'agrupar'] as const)
  const from = values.de || `${today.slice(0, 7)}-01`
  const to = values.ate || today
  const by = values.por === 'month' ? 'month' : 'day'
  const long = (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 > 62

  const overview = useOverview(organization.id, { from, to })
  const flow = useCashFlow(organization.id, { from, to, by: long ? 'month' : by })
  const group = (['category', 'student', 'partner', 'method', 'account'].includes(values.agrupar) ? values.agrupar : 'category') as 'category' | 'student' | 'partner' | 'method' | 'account'
  const breakdown = useBreakdown(organization.id, { from, to, by: group })

  return (
    <>
      <PageHeader title="Financeiro" subtitle="Controle simples do que deve entrar e sair e do que de fato entrou e saiu." />
      <PeriodFilter timezone={organization.timezone} from={from} to={to} onChange={(start, end) => setMany({ de: start, ate: end })} />

      <QueryState query={overview} isEmpty={() => false} empty={null}>
        {(data) => (
          <>
            {data.accounts.length === 0 && (
              <Alert variant="info">
                Comece cadastrando uma <Link to={links.financeAccounts}>conta bancária ou o caixa</Link> com o saldo inicial. Depois é só lançar receitas e despesas.
              </Alert>
            )}

            <Row className="g-3 mb-4">
              <Col xs={6} lg={3}>
                <Link to={links.financeReceivables} className="text-decoration-none">
                  <Stat label="A receber" value={formatCents(data.receivable.outstanding_cents)} hint={data.receivable.overdue.count > 0 ? `${data.receivable.overdue.count} vencidas (${formatCents(data.receivable.overdue.cents)})` : `${formatCents(data.receivable.next_30_days_cents)} nos próximos 30 dias`} />
                </Link>
              </Col>
              <Col xs={6} lg={3}>
                <Link to={links.financePayables} className="text-decoration-none">
                  <Stat label="A pagar" value={formatCents(data.payable.outstanding_cents)} hint={data.payable.overdue.count > 0 ? `${data.payable.overdue.count} vencidas (${formatCents(data.payable.overdue.cents)})` : `${formatCents(data.payable.next_30_days_cents)} nos próximos 30 dias`} />
                </Link>
              </Col>
              <Col xs={6} lg={3}>
                <Stat label="Saldo em contas" value={formatCents(data.consolidated_balance_cents)} hint={`${data.accounts.length} ${data.accounts.length === 1 ? 'conta' : 'contas'}`} />
              </Col>
              <Col xs={6} lg={3}>
                <Stat label="Aguardando liquidação" value={formatCents(data.awaiting_settlement.in_cents)} hint="cartão e boleto: ainda não é dinheiro" />
              </Col>
            </Row>

            <Row className="g-3 mb-4">
              <Col md={6}>
                <Card className="h-100">
                  <Card.Body>
                    <Card.Title as="h2" className="h6">Realizado no período</Card.Title>
                    <dl className="row mb-0 small">
                      <dt className="col-7 fw-normal">Faturamento (recebido)</dt>
                      <dd className="col-5 text-end"><Money cents={data.realized.receipts_cents} tone="success" strong /></dd>
                      <dt className="col-7 fw-normal">Despesas pagas</dt>
                      <dd className="col-5 text-end"><Money cents={data.realized.payments_cents} strong /></dd>
                      <dt className="col-7 fw-normal">Taxas de pagamento</dt>
                      <dd className="col-5 text-end"><Money cents={data.realized.fees_cents} /></dd>
                      <dt className="col-7 fw-normal">Reembolsos e repasses recebidos</dt>
                      <dd className="col-5 text-end"><Money cents={data.realized.pass_through_in_cents} /></dd>
                      <dt className="col-7 fw-normal">Repasses e adiantamentos pagos</dt>
                      <dd className="col-5 text-end"><Money cents={data.realized.pass_through_out_cents} /></dd>
                    </dl>
                    <p className="small text-secondary mt-2 mb-0">{data.basis}</p>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="h-100">
                  <Card.Body>
                    <Card.Title as="h2" className="h6">Saldo por conta</Card.Title>
                    {data.accounts.length === 0 ? (
                      <p className="text-secondary mb-0">Nenhuma conta cadastrada.</p>
                    ) : (
                      <ul className="list-unstyled mb-0 d-grid gap-1">
                        {data.accounts.map((account) => (
                          <li key={account.id} className="d-flex justify-content-between gap-2">
                            <Link to={`${links.financeAccounts}?conta=${account.id}`}>
                              <i className={`bi ${account.kind === 'cash' ? 'bi-cash-stack' : 'bi-bank'} me-2`} aria-hidden="true" />
                              {account.name}
                              {!account.active && <span className="text-secondary"> (inativa)</span>}
                            </Link>
                            <Money cents={account.balance_cents} strong tone={account.balance_cents < 0 ? 'danger' : undefined} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </QueryState>

      <section className="mb-4" aria-labelledby="flow-title">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <h2 id="flow-title" className="h5 mb-0">Fluxo de caixa: previsto × realizado</h2>
          {!long && (
            <Form.Select size="sm" style={{ width: 'auto' }} aria-label="Agrupar fluxo de caixa" value={by} onChange={(event) => setMany({ por: event.target.value })}>
              <option value="day">Por dia</option>
              <option value="month">Por mês</option>
            </Form.Select>
          )}
        </div>
        <QueryState query={flow} isEmpty={(d) => d.rows.length === 0} empty="Nada previsto nem realizado neste período.">
          {(data) => (
            <div className="table-responsive">
              <Table size="sm" className="align-middle">
                <thead>
                  <tr>
                    <th scope="col">{data.by === 'month' ? 'Mês' : 'Dia'}</th>
                    <th scope="col" className="text-end">Entrou</th>
                    <th scope="col" className="text-end">Saiu</th>
                    <th scope="col" className="text-end">A entrar (vencimento)</th>
                    <th scope="col" className="text-end">A sair (vencimento)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.bucket}>
                      <td className="tabular-nums">{data.by === 'month' ? `${row.bucket.slice(5)}/${row.bucket.slice(0, 4)}` : formatDate(row.bucket)}</td>
                      <td className="text-end"><Money cents={row.realized_in_cents} tone={row.realized_in_cents ? 'success' : 'secondary'} /></td>
                      <td className="text-end"><Money cents={row.realized_out_cents} tone={row.realized_out_cents ? undefined : 'secondary'} /></td>
                      <td className="text-end"><Money cents={row.forecast_in_cents} tone="secondary" /></td>
                      <td className="text-end"><Money cents={row.forecast_out_cents} tone="secondary" /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </QueryState>
      </section>

      <section aria-labelledby="by-category-title">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <h2 id="by-category-title" className="h5 mb-0">Realizado por…</h2>
          <Form.Select size="sm" style={{ width: 'auto' }} aria-label="Agrupar o realizado" value={group} onChange={(event) => setMany({ agrupar: event.target.value === 'category' ? '' : event.target.value })}>
            <option value="category">Categoria</option>
            <option value="student">Aluno</option>
            <option value="partner">Parceiro</option>
            <option value="method">Forma de pagamento</option>
            <option value="account">Conta</option>
          </Form.Select>
        </div>
        <QueryState query={breakdown} isEmpty={(d) => d.rows.length === 0} empty="Nenhum recebimento ou pagamento neste período.">
          {(data) => (
            <div className="table-responsive">
              <Table size="sm" className="align-middle">
                <thead>
                  <tr>
                    <th scope="col">{{ category: 'Categoria', student: 'Aluno', partner: 'Parceiro', method: 'Forma de pagamento', account: 'Conta' }[group]}</th>
                    <th scope="col" className="text-end">Recebido</th>
                    <th scope="col" className="text-end">Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td className="text-end"><Money cents={row.received_cents} /></td>
                      <td className="text-end"><Money cents={row.paid_cents} /></td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </QueryState>
      </section>
    </>
  )
}
