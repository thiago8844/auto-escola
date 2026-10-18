import { useDraftProtection } from '../../hooks/useFormProtection'
import { MoneyInput } from '../../components/MoneyInput'
import { useMemo, useState } from 'react'
import { Alert, Button, Col, Collapse, Form, Modal, Row } from 'react-bootstrap'
import { notify } from '../../stores/toastStore'
import { useAccounts, useMethods, usePayInstallment } from '../../hooks/useFinance'
import type { Installment } from '../../types/finance'
import { formatCents, toCents, toReais } from '../../utils/money'
import { todayInTimeZone } from '../../utils/timezone'
import { formatDate } from '../../utils/formatDate'
import { loadLastUsed, saveLastUsed } from '../../utils/financeLastUsed'
import { Money } from './shared'

type Line = { key: string; account_id: string; method_id: string; amount: string; paid_on: string; reference: string; client_ref: string }

type PayModalProps = { organizationId: number; timezone: string; installment: Installment; onClose: () => void }

// Baixa de uma parcela: total, parcial ou dividida em várias formas e contas. Já abre pronta com o saldo e a última forma usada.
export function PayModal({ organizationId, timezone, installment, onClose }: PayModalProps) {
  const type = installment.entry?.type ?? 'receivable'
  const receivable = type === 'receivable'
  const accounts = useAccounts(organizationId)
  const methods = useMethods(organizationId)
  const pay = usePayInstallment(organizationId)
  const today = todayInTimeZone(timezone)
  const remaining = installment.outstanding_cents

  const activeAccounts = (accounts.data ?? []).filter((a) => a.active)
  const activeMethods = (methods.data ?? []).filter((m) => m.active)
  const last = useMemo(() => loadLastUsed(organizationId, type), [organizationId, type])

  const newLine = (amountCents: number, previous?: Line): Line => ({
    key: crypto.randomUUID(),
    account_id: previous?.account_id ?? String(last.account_id ?? ''),
    method_id: previous?.method_id ?? String(last.method_id ?? ''),
    amount: toReais(amountCents),
    paid_on: previous?.paid_on ?? today,
    reference: '',
    // Uma referência por linha: reenviar a mesma baixa (duplo clique, rede) nunca vira duas
    client_ref: crypto.randomUUID(),
  })

  const [lines, setLines] = useState<Line[]>(() => [newLine(remaining)])
  const [showAdjust, setShowAdjust] = useState(false)
  const [adjust, setAdjust] = useState({ discount: '', interest: '', fine: '', fee: '', reason: '' })
  const [error, setError] = useState<string | null>(null)

  const applied = lines.reduce((total, line) => total + toCents(line.amount), 0)
  const discount = toCents(adjust.discount)
  const left = remaining - applied - discount
  const adjusting = discount + toCents(adjust.interest) + toCents(adjust.fine) + toCents(adjust.fee) > 0

  const update = (key: string, patch: Partial<Line>) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))

  const protection = useDraftProtection({ lines, adjust }, onClose, pay.isPending)

  const submit = () => {
    setError(null)
    if (lines.some((line) => !activeAccounts.some((a) => a.id === Number(line.account_id)) || !activeMethods.some((m) => m.id === Number(line.method_id)))) return setError('Escolha a conta e a forma de pagamento de cada linha.')
    if (lines.some((line) => toCents(line.amount) < 1)) return setError('Informe o valor de cada linha.')
    if (applied + discount > remaining) return setError(`O total passa do que falta pagar (${formatCents(remaining)}).`)
    if (adjusting && adjust.reason.trim().length < 3) return setError('Explique o motivo do desconto, juros, multa ou taxa.')

    pay.mutate(
      {
        installmentId: installment.id,
        payments: lines.map((line, index) => ({
          account_id: Number(line.account_id),
          method_id: Number(line.method_id),
          paid_on: line.paid_on,
          applied_cents: toCents(line.amount),
          reference: line.reference.trim() || null,
          client_ref: line.client_ref,
          // Desconto, juros, multa e taxa valem para a baixa inteira: ficam na primeira linha
          ...(index === 0 ? { discount_cents: discount, interest_cents: toCents(adjust.interest), fine_cents: toCents(adjust.fine), fee_cents: toCents(adjust.fee), adjust_reason: adjust.reason.trim() || null } : {}),
        })),
      },
      {
        onSuccess: () => {
          protection.saved()
          saveLastUsed(organizationId, type, { account_id: Number(lines[0].account_id), method_id: Number(lines[0].method_id) })
          const pending = lines.some((line) => (methods.data ?? []).find((m) => m.id === Number(line.method_id))?.settlement_days)
          if (pending) notify.info('Cartão ou boleto: o valor só entra na conta quando você confirmar a liquidação.')
          onClose()
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  return (
    <Modal show onHide={protection.close} centered size="lg" fullscreen="md-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          {receivable ? 'Receber' : 'Pagar'}: parcela {installment.number}/{installment.entry?.installments_count}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="mb-3">
          <strong>{installment.entry?.description}</strong>
          <br />
          <span className="text-secondary">
            Vence em {formatDate(installment.due_date)} · valor <Money cents={installment.amount_cents} /> · falta <Money cents={remaining} strong />
          </span>
        </p>

        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}

        {lines.map((line, index) => (
          <div key={line.key} className="border rounded p-3 mb-3">
            <Row className="g-2">
              <Col sm={4}>
                <Form.Label htmlFor={`amount-${line.key}`} className="small mb-1">Valor (R$)</Form.Label>
                <MoneyInput id={`amount-${line.key}`} value={line.amount} onValueChange={(value) => update(line.key, { amount: value })} />
              </Col>
              <Col sm={4}>
                <Form.Label htmlFor={`method-${line.key}`} className="small mb-1">Forma</Form.Label>
                <Form.Select id={`method-${line.key}`} value={line.method_id} onChange={(event) => update(line.key, { method_id: event.target.value })}>
                  <option value="">Escolha</option>
                  {activeMethods.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                      {m.settlement_days > 0 ? ` (liquida em ${m.settlement_days} d)` : ''}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col sm={4}>
                <Form.Label htmlFor={`account-${line.key}`} className="small mb-1">{receivable ? 'Entra na conta' : 'Sai da conta'}</Form.Label>
                <Form.Select id={`account-${line.key}`} value={line.account_id} onChange={(event) => update(line.key, { account_id: event.target.value })}>
                  <option value="">Escolha</option>
                  {activeAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col sm={4}>
                <Form.Label htmlFor={`date-${line.key}`} className="small mb-1">Data</Form.Label>
                <Form.Control id={`date-${line.key}`} type="date" max={today} value={line.paid_on} onChange={(event) => update(line.key, { paid_on: event.target.value })} />
              </Col>
              <Col sm={index > 0 ? 6 : 8}>
                <Form.Label htmlFor={`ref-${line.key}`} className="small mb-1">Referência (opcional)</Form.Label>
                <Form.Control id={`ref-${line.key}`} placeholder="Ex.: código do Pix, últimos dígitos" value={line.reference} onChange={(event) => update(line.key, { reference: event.target.value })} />
              </Col>
              {index > 0 && (
                <Col sm={2} className="d-flex align-items-end">
                  <Button variant="outline-danger" className="w-100" onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}>
                    Remover
                  </Button>
                </Col>
              )}
            </Row>
          </div>
        ))}

        {accounts.data && activeAccounts.length === 0 && <Alert variant="warning">Nenhuma conta ativa. Cadastre uma conta ou caixa em Financeiro &gt; Contas.</Alert>}

        <div className="d-flex flex-wrap gap-2 mb-3">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => setLines((current) => [...current, newLine(Math.max(left, 0), current[current.length - 1])])}
            disabled={lines.length >= 10 || left <= 0}
          >
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Dividir em outra forma ou conta
          </Button>
          <Button variant="link" size="sm" onClick={() => setShowAdjust(!showAdjust)} aria-expanded={showAdjust}>
            Desconto, juros, multa ou taxa
          </Button>
        </div>

        <Collapse in={showAdjust}>
          <div>
            <div className="border rounded p-3 mb-3">
              <Row className="g-2">
                {([['discount', 'Desconto'], ['interest', 'Juros'], ['fine', 'Multa'], ['fee', 'Taxa de pagamento']] as const).map(([field, label]) => (
                  <Col key={field} xs={6} md={3}>
                    <Form.Label htmlFor={`adj-${field}`} className="small mb-1">{label} (R$)</Form.Label>
                    <MoneyInput id={`adj-${field}`} value={adjust[field]} onValueChange={(value) => setAdjust({ ...adjust, [field]: value })} />
                  </Col>
                ))}
                <Col xs={12}>
                  <Form.Label htmlFor="adj-reason" className="small mb-1">Motivo {adjusting && '(obrigatório)'}</Form.Label>
                  <Form.Control id="adj-reason" value={adjust.reason} onChange={(event) => setAdjust({ ...adjust, reason: event.target.value })} />
                </Col>
              </Row>
              <p className="small text-secondary mt-2 mb-0">
                Desconto abate a parcela sem movimentar caixa; juros e multa entram além do valor; a taxa (ex.: da maquininha) sai do valor recebido.
              </p>
            </div>
          </div>
        </Collapse>

        <div className={`fw-semibold ${left < 0 ? 'text-danger' : ''}`} aria-live="polite">
          {left === 0 ? 'Quita a parcela.' : left > 0 ? `Depois desta baixa, ainda falta ${formatCents(left)}.` : `Passa ${formatCents(-left)} do que falta.`}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={protection.close} disabled={pay.isPending}>
          Cancelar
        </Button>
        <Button onClick={submit} disabled={pay.isPending || accounts.isPending || methods.isPending || left < 0}>
          {receivable ? 'Registrar recebimento' : 'Registrar pagamento'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
