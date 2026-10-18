import { useState } from 'react'
import { Alert, Badge, Button, Card, Table } from 'react-bootstrap'
import { BalanceBar, BalanceStats } from '../../components/BalanceBar'
import { DataTable } from '../../components/DataTable'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { useBalance, useCreditEntries } from '../../hooks/useBalance'
import type { CreditEntry } from '../../types/balance'
import type { Enrollment } from '../../types/enrollment'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDateTime } from '../../utils/formatDateTime'
import { formatMinutes } from '../../utils/formatMinutes'
import { AdjustBalanceModal, ReverseEntryModal } from './BalanceActionModals'
import { PackageModal } from './PackageModal'

const REVERSIBLE = ['grant', 'initial_balance', 'adjustment', 'consume', 'consume_adjustment']
const BUCKET_LABELS = { credit: 'Contratado', reserve: 'Reservado', consume: 'Consumido' } as const
const POLICY_LABELS = {
  basis: { actual: 'pelo tempo realizado', scheduled: 'pelo tempo agendado' },
  charge: { none: 'não consome', full: 'consome a aula inteira' },
} as const

type BalancePanelProps = { organizationId: number; timezone: string; enrollment: Enrollment; canAdjust: boolean }

// Saldo de minutos da matrícula, calculado pela API sobre todo o extrato (nunca por tela)
export function BalancePanel({ organizationId, timezone, enrollment, canAdjust }: BalancePanelProps) {
  const query = useBalance(organizationId, enrollment.id)
  const [page, setPage] = useState(1)
  const entries = useCreditEntries(organizationId, enrollment.id, page)
  const [modal, setModal] = useState<'package' | 'adjust' | null>(null)
  const [reversing, setReversing] = useState<CreditEntry | null>(null)

  return (
    <section aria-labelledby="balance-title" className="mb-5">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h2 id="balance-title" className="h4 mb-0">
          Pacote e saldo de aulas
        </h2>
        <div className="d-flex flex-wrap gap-2">
          {canAdjust && query.data && query.data.has_package && (
            <Button variant="outline-secondary" size="sm" onClick={() => setModal('adjust')}>
              <i className="bi bi-sliders me-1" aria-hidden="true" />
              Ajustar saldo
            </Button>
          )}
          <Button size="sm" onClick={() => setModal('package')}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            {query.data?.has_package ? 'Acrescentar aulas' : 'Contratar aulas'}
          </Button>
        </div>
      </div>

      <QueryState query={query} isEmpty={() => false} empty={null}>
        {(balance) => (
          <>
            {!balance.has_package && (
              <Alert variant="info">
                <i className="bi bi-info-circle me-2" aria-hidden="true" />
                Esta matrícula ainda não tem pacote. Aulas agendadas são tratadas como avulsas, sem controle de saldo.
              </Alert>
            )}
            {balance.has_package && balance.available <= 0 && (
              <Alert variant={balance.available < 0 ? 'danger' : 'warning'}>
                <i className="bi bi-exclamation-triangle-fill me-2" aria-hidden="true" />
                {balance.available < 0
                  ? `O saldo está excedido em ${formatMinutes(-balance.available)} (aula agendada por exceção autorizada). Registre um acréscimo.`
                  : 'Saldo esgotado: novas aulas só podem ser agendadas com um acréscimo ou exceção autorizada com motivo.'}
              </Alert>
            )}

            <Card className="mb-3">
              <Card.Body>
                <BalanceBar balance={balance} height={14} />
                <div className="d-flex flex-wrap gap-3 small text-secondary mt-2 mb-3">
                  <span><span className="balance-dot bg-primary d-inline-block me-1" aria-hidden="true" />Consumido</span>
                  <span><span className="balance-dot bg-info d-inline-block me-1" aria-hidden="true" />Reservado</span>
                  <span><span className="balance-dot bg-success d-inline-block me-1" aria-hidden="true" />Disponível</span>
                </div>
                <BalanceStats balance={balance} reference={balance.reference_minutes} />
                {balance.reference_minutes && (
                  <p className="small text-secondary mt-2 mb-0">Equivalência em aulas calculada com a duração de referência de {balance.reference_minutes} min informada na contratação.</p>
                )}
              </Card.Body>
            </Card>

            {balance.by_category.length > 0 && (
              <Card className="mb-3">
                <Card.Header className="fw-semibold">Por categoria (A e B são controladas separadamente)</Card.Header>
                <Table responsive className="mb-0 align-middle">
                  <thead>
                    <tr>
                      <th scope="col">Categoria</th>
                      <th scope="col" className="text-end">Contratado</th>
                      <th scope="col" className="text-end">Reservado</th>
                      <th scope="col" className="text-end">Consumido</th>
                      <th scope="col" className="text-end">Disponível</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balance.by_category.map((row) => (
                      <tr key={row.category ?? 'none'}>
                        <th scope="row" className="fw-normal">
                          {row.category ?? <span title="Crédito sem categoria: use um ajuste para distribuí-lo entre A e B.">A distribuir</span>}
                        </th>
                        <td className="text-end tabular-nums">{formatMinutes(row.contracted)}</td>
                        <td className="text-end tabular-nums">{formatMinutes(row.reserved)}</td>
                        <td className="text-end tabular-nums">{formatMinutes(row.consumed)}</td>
                        <td className="text-end tabular-nums fw-semibold">{formatMinutes(row.available)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            )}

            {balance.policy && (
              <p className="small text-secondary">
                <i className="bi bi-file-earmark-text me-1" aria-hidden="true" />
                Política vigente: consumo {POLICY_LABELS.basis[balance.policy.consume_basis]} · falta {POLICY_LABELS.charge[balance.policy.absence_charge]} · cancelamento tardio{' '}
                {balance.policy.late_cancel_charge === 'full' ? `consome se avisado com menos de ${balance.policy.cancel_notice_hours} h` : 'não consome'}.
              </p>
            )}

            {balance.packages.length > 0 && (
              <details className="mb-3">
                <summary className="fw-semibold">Contratações ({balance.packages.length})</summary>
                <ul className="list-unstyled mt-2 d-grid gap-1 mb-0">
                  {balance.packages.map((pkg) => (
                    <li key={pkg.id} className="small">
                      <strong>{pkg.description}</strong> · {formatMinutes(pkg.minutes)}
                      {pkg.category && ` · ${pkg.category}`}
                      {pkg.price_cents != null && ` · ${formatCurrency(pkg.price_cents / 100)}`}{' '}
                      <span className="text-secondary">({formatDateTime(pkg.created_at, timezone)})</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </QueryState>

      <h3 className="h5 mt-4 mb-3">Extrato</h3>
      <QueryState query={entries} isEmpty={(d) => d.data.length === 0} empty="Nenhum movimento registrado ainda.">
        {(data) => (
          <>
            <DataTable
              rows={data.data}
              getKey={(entry) => entry.id}
              columns={[
                { header: 'Data', primary: true, cell: (entry) => <span className="tabular-nums">{formatDateTime(entry.occurred_at, timezone)}</span> },
                {
                  header: 'Movimento',
                  cell: (entry) => (
                    <>
                      {entry.type_label}
                      {entry.category && <Badge bg="body-secondary" text="body" className="border fw-normal ms-1">{entry.category}</Badge>}
                      {entry.reverses_entry_id && <span className="small text-secondary d-block">Estorna o movimento #{entry.reverses_entry_id}</span>}
                    </>
                  ),
                },
                { header: 'Coluna', cell: (entry) => BUCKET_LABELS[entry.bucket] },
                {
                  header: 'Minutos',
                  cell: (entry) => (
                    <span className={`tabular-nums fw-semibold ${entry.minutes < 0 ? 'text-danger' : ''}`}>
                      {entry.minutes > 0 ? '+' : '−'}
                      {formatMinutes(Math.abs(entry.minutes))}
                    </span>
                  ),
                },
                { header: 'Motivo', cell: (entry) => <span className="text-break">{entry.reason ?? '—'}</span> },
                { header: 'Responsável', cell: (entry) => entry.actor?.name ?? 'Sistema' },
                {
                  header: 'Ações',
                  actions: true,
                  cell: (entry, { mobile }) =>
                    canAdjust &&
                    REVERSIBLE.includes(entry.type) &&
                    !data.data.some((other) => other.reverses_entry_id === entry.id) && (
                      <Button variant="outline-danger" size={mobile ? undefined : 'sm'} className={mobile ? 'flex-fill' : undefined} onClick={() => setReversing(entry)}>
                        Estornar
                      </Button>
                    ),
                },
              ]}
            />
            <Pagination page={data.meta.current_page} lastPage={data.meta.last_page} total={data.meta.total} perPage={data.meta.per_page} onPageChange={setPage} />
          </>
        )}
      </QueryState>

      {modal === 'package' && <PackageModal organizationId={organizationId} enrollment={enrollment} hasPackage={!!query.data?.has_package} onClose={() => setModal(null)} />}
      {modal === 'adjust' && <AdjustBalanceModal organizationId={organizationId} enrollment={enrollment} onClose={() => setModal(null)} />}
      {reversing && <ReverseEntryModal organizationId={organizationId} enrollmentId={enrollment.id} entry={reversing} onClose={() => setReversing(null)} />}
    </section>
  )
}
