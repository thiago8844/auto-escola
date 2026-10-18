import { useState } from 'react'
import { Alert, Button, Card } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { QueryState } from '../../components/QueryState'
import { organizationPaths } from '../../config/paths'
import { useEnrollmentFinance } from '../../hooks/useFinance'
import type { Enrollment } from '../../types/enrollment'
import type { Installment } from '../../types/finance'
import type { Organization } from '../../types/organization'
import { formatDate } from '../../utils/formatDate'
import { ChargeModal } from '../finance/ChargeModal'
import { EntryDetailModal } from '../finance/EntryDetailModal'
import { PayModal } from '../finance/PayModal'
import { Money, SituationBadge } from '../finance/shared'

// Cobrança e recebimentos da matrícula, sem sair dela. A cobrança só é gerada por ação explícita e nunca duplica.
export function EnrollmentFinancePanel({ organization, enrollment, canManage }: { organization: Organization; enrollment: Enrollment; canManage: boolean }) {
  const links = organizationPaths(organization.id)
  const query = useEnrollmentFinance(organization.id, enrollment.id)
  const [charging, setCharging] = useState<number | null>(null)
  const [paying, setPaying] = useState<Installment | null>(null)
  const [openEntry, setOpenEntry] = useState<number | null>(null)

  return (
    <section className="mb-4" aria-labelledby="enrollment-finance-title">
      <h2 id="enrollment-finance-title" className="h4 mb-3">Cobrança e recebimentos</h2>
      <QueryState query={query} isEmpty={() => false} empty={null}>
        {(data) => {
          const uncharged = data.packages.filter((p) => !p.charged)
          return (
            <Card>
              <Card.Body>
                <p className="mb-2">
                  Cobrado <Money cents={data.charged_cents} strong /> · recebido <Money cents={data.received_cents} tone="success" strong /> · falta <Money cents={data.charged_cents - data.received_cents} strong />
                </p>
                {data.packages.length === 0 && <Alert variant="secondary" className="small">Registre a contratação de aulas (pacote) para poder gerar a cobrança.</Alert>}
                {uncharged.map((pkg) => (
                  <div key={pkg.id} className="d-flex flex-wrap justify-content-between align-items-center gap-2 border rounded p-2 mb-2">
                    <span>
                      {pkg.description ?? 'Pacote de aulas'}
                      {pkg.price_cents ? <> · <Money cents={pkg.price_cents} /></> : <span className="text-secondary"> · sem valor</span>}
                      <span className="small text-secondary"> — ainda sem cobrança</span>
                    </span>
                    <Button size="sm" onClick={() => setCharging(pkg.id)}>Gerar cobrança</Button>
                  </div>
                ))}
                {data.entries.filter((e) => e.status === 'active').map((entry) => (
                  <div key={entry.id} className="border rounded p-2 mb-2">
                    <div className="d-flex flex-wrap justify-content-between gap-2">
                      <button type="button" className="btn btn-link p-0 text-start text-decoration-none" onClick={() => setOpenEntry(entry.id)}>
                        {entry.description} · <Money cents={entry.total_cents} />
                        {entry.partner && <span className="small text-secondary"> · paga: {entry.partner.name}</span>}
                      </button>
                      <Link to={`${links.financeReceivables}?lancamento=${entry.id}`} className="small">Abrir no financeiro</Link>
                    </div>
                    <ul className="list-unstyled mb-0 mt-1 d-grid gap-1">
                      {entry.installments.map((installment) => (
                        <li key={installment.id} className="d-flex flex-wrap align-items-center justify-content-between gap-2 small">
                          <span>
                            {installment.number}/{entry.installments_count} · {formatDate(installment.due_date)} · <Money cents={installment.amount_cents} /> <SituationBadge situation={installment.situation} pendingCents={installment.awaiting_settlement_cents} />
                          </span>
                          {installment.outstanding_cents > 0 && installment.status !== 'cancelled' && (
                            <Button size="sm" variant="outline-primary" onClick={() => setPaying({ ...installment, entry })}>Receber</Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </Card.Body>
            </Card>
          )
        }}
      </QueryState>

      {charging !== null && (
        <ChargeModal
          organizationId={organization.id}
          timezone={organization.timezone}
          title="Cobrar a contratação"
          packageId={charging}
          path={`/enrollments/${enrollment.id}/finance/charge`}
          type="receivable"
          description={`Gera a conta a receber de ${enrollment.student?.name ?? 'o aluno'} a partir do pacote. Aulas consumidas, edições da matrícula e novos envios não geram outra cobrança.`}
          defaultTotalCents={(query.data?.packages.find((p) => p.id === charging)?.price_cents ?? enrollment.price_cents) ?? null}
          partnerName={enrollment.partner?.name ?? null}
          onClose={() => setCharging(null)}
        />
      )}
      {paying && <PayModal organizationId={organization.id} timezone={organization.timezone} installment={paying} onClose={() => setPaying(null)} />}
      {openEntry !== null && <EntryDetailModal organizationId={organization.id} timezone={organization.timezone} entryId={openEntry} canManage={canManage} onClose={() => setOpenEntry(null)} />}
    </section>
  )
}
