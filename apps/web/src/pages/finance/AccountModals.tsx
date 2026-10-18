import { useState } from 'react'
import { Alert, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { NumericFormat } from 'react-number-format'
import { BootstrapInput } from '../../components/BootstrapInput'
import { useAdjustAccount, useCreateAccount, useCreateTransfer, useReconcileAccount, useUpdateAccount } from '../../hooks/useFinance'
import type { FinanceAccount, Statement } from '../../types/finance'
import { formatDate } from '../../utils/formatDate'
import { formatCents, toCents } from '../../utils/money'
import { todayInTimeZone } from '../../utils/timezone'

function MoneyInput({ id, value, onChange, allowNegative }: { id: string; value: string; onChange: (value: string) => void; allowNegative?: boolean }) {
  return (
    <NumericFormat
      id={id}
      customInput={BootstrapInput}
      inputMode="decimal"
      prefix="R$ "
      thousandSeparator="."
      decimalSeparator=","
      decimalScale={2}
      fixedDecimalScale
      allowNegative={allowNegative}
      value={value}
      valueIsNumericString
      onValueChange={(values) => onChange(values.value)}
    />
  )
}

type Base = { organizationId: number; timezone: string; onClose: () => void }

export function AccountFormModal({ organizationId, timezone, account, onClose }: Base & { account?: FinanceAccount }) {
  const create = useCreateAccount(organizationId)
  const update = useUpdateAccount(organizationId)
  const [name, setName] = useState(account?.name ?? '')
  const [kind, setKind] = useState<'bank' | 'cash'>(account?.kind ?? 'bank')
  const [institution, setInstitution] = useState(account?.institution ?? '')
  const [identification, setIdentification] = useState(account?.identification ?? '')
  const [opening, setOpening] = useState(account ? String(account.opening_balance_cents / 100) : '0')
  const [openingDate, setOpeningDate] = useState(account?.opening_date ?? todayInTimeZone(timezone))
  const [error, setError] = useState<string | null>(null)
  const pending = create.isPending || update.isPending

  const submit = () => {
    setError(null)
    if (name.trim().length < 2) return setError('Dê um nome à conta (ex.: Banco principal, Caixa).')
    const common = { name: name.trim(), institution: institution.trim() || null, identification: identification.trim() || null }
    const done = { onSuccess: onClose, onError: (e: Error) => setError(e.message) }

    if (account) update.mutate({ accountId: account.id, ...common }, done)
    else create.mutate({ ...common, kind, opening_balance_cents: toCents(opening), opening_date: openingDate }, done)
  }

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">{account ? 'Editar conta' : 'Nova conta ou caixa'}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" role="alert">{error}</Alert>}
        <Form.Group className="mb-3" controlId="acc-name">
          <Form.Label>Nome</Form.Label>
          <Form.Control autoFocus value={name} onChange={(event) => setName(event.target.value)} />
        </Form.Group>
        {!account && (
          <Form.Group className="mb-3" controlId="acc-kind">
            <Form.Label>Tipo</Form.Label>
            <Form.Select value={kind} onChange={(event) => setKind(event.target.value as 'bank' | 'cash')}>
              <option value="bank">Conta bancária</option>
              <option value="cash">Caixa (dinheiro em mãos)</option>
            </Form.Select>
          </Form.Group>
        )}
        <Row className="g-3 mb-3">
          <Col sm={6}>
            <Form.Label htmlFor="acc-institution">Instituição (opcional)</Form.Label>
            <Form.Control id="acc-institution" value={institution} onChange={(event) => setInstitution(event.target.value)} />
          </Col>
          <Col sm={6}>
            <Form.Label htmlFor="acc-ident">Agência e conta (opcional)</Form.Label>
            <Form.Control id="acc-ident" value={identification} onChange={(event) => setIdentification(event.target.value)} />
          </Col>
        </Row>
        {!account && (
          <Row className="g-3">
            <Col sm={6}>
              <Form.Label htmlFor="acc-opening">Saldo inicial</Form.Label>
              <MoneyInput id="acc-opening" value={opening} onChange={setOpening} allowNegative />
            </Col>
            <Col sm={6}>
              <Form.Label htmlFor="acc-date">Em</Form.Label>
              <Form.Control id="acc-date" type="date" max={todayInTimeZone(timezone)} value={openingDate} onChange={(event) => setOpeningDate(event.target.value)} />
            </Col>
            <Col xs={12}>
              <p className="small text-secondary mb-0">O saldo inicial é o dinheiro que já existia na conta: ele não é receita. Depois que houver movimentações, só se corrige por “Ajustar saldo”, com motivo.</p>
            </Col>
          </Row>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose} disabled={pending}>Cancelar</Button>
        <Button onClick={submit} disabled={pending}>{account ? 'Salvar' : 'Criar conta'}</Button>
      </Modal.Footer>
    </Modal>
  )
}

export function AdjustModal({ organizationId, timezone, account, onClose }: Base & { account: FinanceAccount }) {
  const adjust = useAdjustAccount(organizationId)
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(todayInTimeZone(timezone))
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    if (toCents(amount) < 1) return setError('Informe o valor do ajuste.')
    if (reason.trim().length < 3) return setError('Explique o motivo do ajuste.')
    adjust.mutate({ accountId: account.id, direction, amount_cents: toCents(amount), reason: reason.trim(), occurred_on: date }, { onSuccess: onClose, onError: (e) => setError(e.message) })
  }

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">Ajustar saldo: {account.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" role="alert">{error}</Alert>}
        <p className="small text-secondary">O ajuste entra no extrato como um movimento com o motivo. Nada do que já aconteceu é alterado.</p>
        <Form.Group className="mb-3" controlId="adj-direction">
          <Form.Label>O saldo precisa…</Form.Label>
          <Form.Select value={direction} onChange={(event) => setDirection(event.target.value as 'in' | 'out')}>
            <option value="in">aumentar (entrada)</option>
            <option value="out">diminuir (saída)</option>
          </Form.Select>
        </Form.Group>
        <Row className="g-3 mb-3">
          <Col sm={6}>
            <Form.Label htmlFor="adj-amount">Valor</Form.Label>
            <MoneyInput id="adj-amount" value={amount} onChange={setAmount} />
          </Col>
          <Col sm={6}>
            <Form.Label htmlFor="adj-date">Data</Form.Label>
            <Form.Control id="adj-date" type="date" max={todayInTimeZone(timezone)} value={date} onChange={(event) => setDate(event.target.value)} />
          </Col>
        </Row>
        <Form.Group controlId="adj-reason-text">
          <Form.Label>Motivo</Form.Label>
          <Form.Control value={reason} placeholder="Ex.: tarifa bancária, diferença de troco" onChange={(event) => setReason(event.target.value)} />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose} disabled={adjust.isPending}>Cancelar</Button>
        <Button onClick={submit} disabled={adjust.isPending}>Ajustar saldo</Button>
      </Modal.Footer>
    </Modal>
  )
}

export function TransferModal({ organizationId, timezone, accounts, onClose }: Base & { accounts: FinanceAccount[] }) {
  const transfer = useCreateTransfer(organizationId)
  const active = accounts.filter((a) => a.active)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(todayInTimeZone(timezone))
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    setError(null)
    if (!from || !to) return setError('Escolha a conta de origem e a de destino.')
    if (from === to) return setError('Escolha contas diferentes.')
    if (toCents(amount) < 1) return setError('Informe o valor.')
    if (reason.trim().length < 3) return setError('Explique o motivo da transferência.')
    transfer.mutate({ from_account_id: Number(from), to_account_id: Number(to), amount_cents: toCents(amount), occurred_on: date, reason: reason.trim() }, { onSuccess: onClose, onError: (e) => setError(e.message) })
  }

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">Transferir entre contas</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" role="alert">{error}</Alert>}
        <p className="small text-secondary">O valor sai de uma conta e entra na outra de uma vez. Transferência não é receita nem despesa.</p>
        <Row className="g-3 mb-3">
          <Col sm={6}>
            <Form.Label htmlFor="tr-from">De</Form.Label>
            <Form.Select id="tr-from" value={from} onChange={(event) => setFrom(event.target.value)}>
              <option value="">Escolha</option>
              {active.map((a) => <option key={a.id} value={a.id}>{a.name} ({formatCents(a.balance_cents ?? 0)})</option>)}
            </Form.Select>
          </Col>
          <Col sm={6}>
            <Form.Label htmlFor="tr-to">Para</Form.Label>
            <Form.Select id="tr-to" value={to} onChange={(event) => setTo(event.target.value)}>
              <option value="">Escolha</option>
              {active.filter((a) => String(a.id) !== from).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Form.Select>
          </Col>
          <Col sm={6}>
            <Form.Label htmlFor="tr-amount">Valor</Form.Label>
            <MoneyInput id="tr-amount" value={amount} onChange={setAmount} />
          </Col>
          <Col sm={6}>
            <Form.Label htmlFor="tr-date">Data</Form.Label>
            <Form.Control id="tr-date" type="date" max={todayInTimeZone(timezone)} value={date} onChange={(event) => setDate(event.target.value)} />
          </Col>
        </Row>
        <Form.Group controlId="tr-reason">
          <Form.Label>Motivo</Form.Label>
          <Form.Control value={reason} placeholder="Ex.: depósito do caixa no banco" onChange={(event) => setReason(event.target.value)} />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose} disabled={transfer.isPending}>Cancelar</Button>
        <Button onClick={submit} disabled={transfer.isPending}>Transferir</Button>
      </Modal.Footer>
    </Modal>
  )
}

// Conferência manual: marque o que aparece no extrato do banco e informe o saldo dele; o sistema mostra a diferença
export function ReconcileModal({ organizationId, timezone, account, statement, onClose }: Base & { account: FinanceAccount; statement: Statement | undefined }) {
  const reconcile = useReconcileAccount(organizationId)
  const [date, setDate] = useState(todayInTimeZone(timezone))
  const [balance, setBalance] = useState('')
  const [checked, setChecked] = useState<number[]>([])
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pending = (statement?.lines ?? []).filter((line) => !line.reconciled)
  const result = reconcile.data

  const submit = () => {
    setError(null)
    if (balance === '') return setError('Informe o saldo que aparece no extrato do banco.')
    reconcile.mutate({ accountId: account.id, statement_date: date, statement_balance_cents: toCents(balance), movement_ids: checked, notes: notes.trim() || null }, { onError: (e) => setError(e.message) })
  }

  return (
    <Modal show onHide={onClose} centered size="lg" fullscreen="md-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">Conferir extrato: {account.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger" role="alert">{error}</Alert>}
        {result && (
          <Alert variant={result.difference_cents === 0 ? 'success' : 'warning'} role="status">
            {result.difference_cents === 0
              ? 'Conferido: o saldo do sistema bate com o extrato.'
              : `Divergência de ${formatCents(Math.abs(result.difference_cents))}: o extrato está ${result.difference_cents > 0 ? 'acima' : 'abaixo'} do sistema (${formatCents(result.system_balance_cents)}). Revise as movimentações ou faça um ajuste com motivo.`}
          </Alert>
        )}
        <Row className="g-3 mb-3">
          <Col sm={6}>
            <Form.Label htmlFor="rec-date">Data do extrato</Form.Label>
            <Form.Control id="rec-date" type="date" max={todayInTimeZone(timezone)} value={date} onChange={(event) => setDate(event.target.value)} />
          </Col>
          <Col sm={6}>
            <Form.Label htmlFor="rec-balance">Saldo no extrato</Form.Label>
            <MoneyInput id="rec-balance" value={balance} onChange={setBalance} allowNegative />
          </Col>
        </Row>
        {pending.length > 0 && (
          <>
            <p className="small mb-1">Marque o que já confere com o extrato:</p>
            <div className="table-responsive" style={{ maxHeight: 240 }}>
              <Table size="sm" className="align-middle">
                <tbody>
                  {pending.map((line) => (
                    <tr key={line.id}>
                      <td style={{ width: 32 }}>
                        <Form.Check aria-label={`Conferir: ${line.description}`} checked={checked.includes(line.id)} onChange={(event) => setChecked(event.target.checked ? [...checked, line.id] : checked.filter((id) => id !== line.id))} />
                      </td>
                      <td className="tabular-nums">{formatDate(line.date)}</td>
                      <td>{line.description}</td>
                      <td className={`text-end tabular-nums ${line.direction === 'in' ? 'text-success' : ''}`}>{line.direction === 'in' ? '+' : '−'}{formatCents(line.amount_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
        <Form.Group className="mt-2" controlId="rec-notes">
          <Form.Label className="small">Observação (opcional)</Form.Label>
          <Form.Control value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onClose}>{result ? 'Fechar' : 'Cancelar'}</Button>
        {!result && <Button onClick={submit} disabled={reconcile.isPending}>Registrar conferência</Button>}
      </Modal.Footer>
    </Modal>
  )
}
