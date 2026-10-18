import { Alert, Badge, Button, Card, Table } from 'react-bootstrap'
import { Link, useLocation, useParams } from 'react-router-dom'
import { QueryState } from '../../components/QueryState'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useReceipt } from '../../hooks/useFinance'
import { formatDate } from '../../utils/formatDate'
import { formatCents } from '../../utils/money'

// Comprovante interno de recebimento ou pagamento, pronto para imprimir (não é documento fiscal)
export default function ReceiptPage() {
  const { paymentId = '' } = useParams()
  const location = useLocation()
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const query = useReceipt(organization.id, paymentId)

  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(receipt) => (
        <div className="print-area" style={{ maxWidth: 720 }}>
          <div className="d-flex justify-content-between align-items-center mb-3 d-print-none">
            <Link to={typeof location.state?.from === 'string' && location.state.from.startsWith(`${links.home}/`) ? location.state.from : `${receipt.entry_type === 'payable' ? links.financePayables : links.financeReceivables}?lancamento=${receipt.entry_id}`}>← Voltar ao lançamento</Link>
            <Button onClick={() => window.print()}>
              <i className="bi bi-printer me-2" aria-hidden="true" />
              Imprimir
            </Button>
          </div>
          <Card>
            <Card.Body className="p-4">
              <div className="d-flex justify-content-between align-items-start gap-3 mb-3">
                <div>
                  <h1 className="h4 mb-0">{receipt.kind}</h1>
                  <div className="text-secondary">Nº {receipt.number}</div>
                </div>
                <div className="text-end small">
                  <strong>{receipt.organization.name}</strong>
                  {receipt.organization.document && <div>Documento: {receipt.organization.document}</div>}
                  {receipt.organization.address && <div>{receipt.organization.address}</div>}
                  {(receipt.organization.city || receipt.organization.state) && <div>{[receipt.organization.city, receipt.organization.state].filter(Boolean).join(' - ')}</div>}
                </div>
              </div>
              {receipt.status === 'reversed' && <Alert variant="danger">Este pagamento foi estornado em {receipt.payment.reversed_at ? formatDate(receipt.payment.reversed_at) : ''}. O recibo não vale mais.</Alert>}
              {receipt.status === 'pending' && <Alert variant="warning">Pagamento aguardando liquidação: o valor ainda não foi confirmado no caixa.</Alert>}
              <p>
                {receipt.entry_type === 'payable' ? 'Pagamos a' : 'Recebemos de'} <strong>{receipt.counterparty ?? 'pessoa não identificada'}</strong> a quantia de <strong>{formatCents(receipt.payment.gross_cents)}</strong> referente a{' '}
                <strong>{receipt.description}</strong> (parcela {receipt.installment}).
              </p>
              <Table size="sm" className="mb-3">
                <tbody>
                  <tr><th scope="row" className="fw-normal">Valor aplicado na parcela</th><td className="text-end tabular-nums">{formatCents(receipt.payment.applied_cents)}</td></tr>
                  {receipt.payment.discount_cents > 0 && <tr><th scope="row" className="fw-normal">Desconto</th><td className="text-end tabular-nums">{formatCents(receipt.payment.discount_cents)}</td></tr>}
                  {receipt.payment.interest_cents > 0 && <tr><th scope="row" className="fw-normal">Juros</th><td className="text-end tabular-nums">{formatCents(receipt.payment.interest_cents)}</td></tr>}
                  {receipt.payment.fine_cents > 0 && <tr><th scope="row" className="fw-normal">Multa</th><td className="text-end tabular-nums">{formatCents(receipt.payment.fine_cents)}</td></tr>}
                  <tr><th scope="row">{receipt.entry_type === 'payable' ? 'Total pago' : 'Total recebido'}</th><td className="text-end tabular-nums fw-semibold">{formatCents(receipt.payment.gross_cents)}</td></tr>
                </tbody>
              </Table>
              <dl className="row small mb-3">
                <dt className="col-sm-4 fw-normal">Data</dt><dd className="col-sm-8">{formatDate(receipt.payment.paid_on)}</dd>
                <dt className="col-sm-4 fw-normal">Forma de pagamento</dt><dd className="col-sm-8">{receipt.payment.method.name}</dd>
                <dt className="col-sm-4 fw-normal">Conta</dt><dd className="col-sm-8">{receipt.payment.account.name}</dd>
                {receipt.payment.reference && (<><dt className="col-sm-4 fw-normal">Referência</dt><dd className="col-sm-8 text-break">{receipt.payment.reference}</dd></>)}
                {receipt.payment.created_by && (<><dt className="col-sm-4 fw-normal">Registrado por</dt><dd className="col-sm-8">{receipt.payment.created_by.name}</dd></>)}
              </dl>
              <p className="small text-secondary mb-0"><Badge bg="secondary" className="me-2">Interno</Badge>{receipt.notice}</p>
            </Card.Body>
          </Card>
        </div>
      )}
    </QueryState>
  )
}
