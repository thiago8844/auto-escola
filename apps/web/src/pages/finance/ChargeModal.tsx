import { useMemo, useState } from 'react'
import { Alert, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { NumericFormat } from 'react-number-format'
import { Link } from 'react-router-dom'
import { BootstrapInput } from '../../components/BootstrapInput'
import { PERIODICITY_LABELS } from '../../config/finance'
import { organizationPaths } from '../../config/paths'
import { useChargeFrom, useParties } from '../../hooks/useFinance'
import type { EntryType } from '../../types/finance'
import { planInstallments, type Periodicity } from '../../utils/installments'
import { formatCents, sumCents, toCents } from '../../utils/money'
import { todayInTimeZone } from '../../utils/timezone'

type ChargeModalProps = {
  organizationId: number
  timezone: string
  title: string
  // Rota da integração, sob o espaço (ex.: /enrollments/3/finance/charge)
  path: string
  packageId?: number
  type: EntryType
  description: string
  defaultTotalCents: number | null
  defaultDue?: string | null
  // Pagador: aluno ou CFC parceiro (só quando a matrícula tem parceiro)
  partnerName?: string | null
  // Despesa: permite escolher o favorecido
  withParty?: boolean
  onClose: () => void
}

// Gera a cobrança ou a despesa a partir de outro módulo (contratação, manutenção, taxa). É uma ação explícita e única:
// se o lançamento já existir, a tela avisa e leva até ele em vez de criar outro.
export function ChargeModal(props: ChargeModalProps) {
  const { organizationId, timezone, title, path, type, description, defaultTotalCents, defaultDue, partnerName, withParty, onClose } = props
  const links = organizationPaths(organizationId)
  const today = todayInTimeZone(timezone)
  const charge = useChargeFrom(organizationId)
  const parties = useParties(organizationId)
  const [total, setTotal] = useState(defaultTotalCents ? String(defaultTotalCents / 100) : '')
  const [count, setCount] = useState('1')
  const [firstDue, setFirstDue] = useState(defaultDue ?? today)
  const [periodicity, setPeriodicity] = useState<Periodicity>('monthly')
  const [payer, setPayer] = useState<'student' | 'partner'>('student')
  const [partyId, setPartyId] = useState('')
  const [edited, setEdited] = useState<Array<{ due_date: string; amount: string }> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<number | null>(null)
  const [createdEntryId, setCreatedEntryId] = useState<number | null>(null)

  const totalCents = toCents(total)
  const planned = useMemo(
    () => planInstallments(totalCents, Math.max(1, Number(count) || 1), firstDue, periodicity).map((row) => ({ due_date: row.due_date, amount: String(row.amount_cents / 100) })),
    [totalCents, count, firstDue, periodicity],
  )
  const rows = edited ?? planned
  const diff = totalCents - sumCents(rows.map((row) => toCents(row.amount)))

  const submit = () => {
    setError(null)
    if (totalCents < 1) return setError('Informe o valor.')
    if (diff !== 0) return setError(`A soma das parcelas precisa fechar o total (${diff > 0 ? 'faltam' : 'sobram'} ${formatCents(Math.abs(diff))}).`)
    charge.mutate(
      {
        path,
        body: {
          package_id: props.packageId,
          total_cents: totalCents,
          installments: rows.map((row) => ({ due_date: row.due_date, amount_cents: toCents(row.amount) })),
          ...(partnerName ? { payer } : {}),
          ...(withParty && partyId ? { party_id: Number(partyId) } : {}),
        },
      },
      {
        onSuccess: (entry) => setCreatedEntryId(entry.id),
        onError: (e) => {
          if (e.code === 'entry_already_exists') setExisting((e.body?.existing_entry_id as number | undefined) ?? 0)
          setError(e.message)
        },
      },
    )
  }

  if (createdEntryId !== null) {
    return (
      <Modal show onHide={onClose} centered>
        <Modal.Header closeButton>
          <Modal.Title as="h2" className="h5">{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="success" className="mb-0">
            {type === 'receivable' ? 'Cobrança gerada.' : 'Despesa lançada.'} Acompanhe e dê baixa em{' '}
            <Link to={`${type === 'receivable' ? links.financeReceivables : links.financePayables}?lancamento=${createdEntryId}`}>{type === 'receivable' ? 'Financeiro > Receitas' : 'Financeiro > Despesas'}</Link>.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={onClose}>Fechar</Button>
        </Modal.Footer>
      </Modal>
    )
  }

  return (
    <Modal show onHide={onClose} centered size="lg" fullscreen="md-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Alert variant="danger" role="alert">
            {error}{' '}
            {existing !== null && (
              <Link to={`${type === 'receivable' ? links.financeReceivables : links.financePayables}${existing ? `?lancamento=${existing}` : ''}`}>Abrir o lançamento existente</Link>
            )}
          </Alert>
        )}
        <p className="mb-3">{description}</p>
        <Row className="g-3 mb-3">
          <Col sm={6}>
            <Form.Label htmlFor="charge-total">Valor total</Form.Label>
            <NumericFormat id="charge-total" customInput={BootstrapInput} inputMode="decimal" prefix="R$ " thousandSeparator="." decimalSeparator="," decimalScale={2} fixedDecimalScale allowNegative={false} value={total} valueIsNumericString onValueChange={(values) => { setTotal(values.value); setEdited(null) }} />
          </Col>
          {partnerName && (
            <Col sm={6}>
              <Form.Label htmlFor="charge-payer">Quem paga</Form.Label>
              <Form.Select id="charge-payer" value={payer} onChange={(event) => setPayer(event.target.value as 'student' | 'partner')}>
                <option value="student">O aluno</option>
                <option value="partner">{partnerName} (auto escola parceira)</option>
              </Form.Select>
            </Col>
          )}
          {withParty && (
            <Col sm={6}>
              <Form.Label htmlFor="charge-party">Favorecido (opcional)</Form.Label>
              <Form.Select id="charge-party" value={partyId} onChange={(event) => setPartyId(event.target.value)}>
                <option value="">Sem favorecido</option>
                {parties.data?.filter((p) => p.active).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Form.Select>
            </Col>
          )}
        </Row>
        <Row className="g-2 align-items-end">
          <Col xs={4} sm={3}>
            <Form.Label htmlFor="charge-count" className="small mb-1">Parcelas</Form.Label>
            <Form.Control id="charge-count" inputMode="numeric" value={count} onChange={(event) => { setCount(event.target.value.replace(/\D/g, '').slice(0, 3)); setEdited(null) }} />
          </Col>
          <Col xs={8} sm={5}>
            <Form.Label htmlFor="charge-first" className="small mb-1">Primeiro vencimento</Form.Label>
            <Form.Control id="charge-first" type="date" value={firstDue} onChange={(event) => { setFirstDue(event.target.value); setEdited(null) }} />
          </Col>
          <Col xs={12} sm={4}>
            <Form.Label htmlFor="charge-period" className="small mb-1">Periodicidade</Form.Label>
            <Form.Select id="charge-period" value={periodicity} onChange={(event) => { setPeriodicity(event.target.value as Periodicity); setEdited(null) }}>
              {Object.entries(PERIODICITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Form.Select>
          </Col>
        </Row>
        {rows.length > 0 && (
          <div className="table-responsive mt-3">
            <Table size="sm" className="align-middle mb-1">
              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td style={{ width: 70 }}>{index + 1}/{rows.length}</td>
                    <td><Form.Control size="sm" type="date" aria-label={`Vencimento da parcela ${index + 1}`} value={row.due_date} onChange={(event) => setEdited(rows.map((r, i) => (i === index ? { ...r, due_date: event.target.value } : r)))} /></td>
                    <td><Form.Control size="sm" inputMode="decimal" aria-label={`Valor da parcela ${index + 1}`} value={row.amount} onChange={(event) => setEdited(rows.map((r, i) => (i === index ? { ...r, amount: event.target.value.replace(',', '.') } : r)))} /></td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className={`small ${diff === 0 ? 'text-success' : 'text-danger'}`} aria-live="polite">
              {diff === 0 ? 'A soma das parcelas fecha com o total.' : `${diff > 0 ? 'Faltam' : 'Sobram'} ${formatCents(Math.abs(diff))} para fechar o total.`}
            </div>
          </div>
        )}
        <p className="small text-secondary mt-3 mb-0">Gerar de novo não cria outro título: a referência é única. Depois de gerar, dê a baixa em Financeiro.</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose} disabled={charge.isPending}>Cancelar</Button>
        <Button onClick={submit} disabled={charge.isPending}>{type === 'receivable' ? 'Gerar cobrança' : 'Lançar despesa'}</Button>
      </Modal.Footer>
    </Modal>
  )
}
