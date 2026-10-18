import { useDraftProtection } from '../../hooks/useFormProtection'
import { MoneyInput } from '../../components/MoneyInput'
import { useMemo, useState } from 'react'
import { Alert, Button, Col, Form, Modal, Row, Table } from 'react-bootstrap'
import { NumericFormat } from 'react-number-format'
import { BootstrapInput } from '../../components/BootstrapInput'
import { PERIODICITY_LABELS } from '../../config/finance'
import { useAccounts, useCategories, useCreateEntry, useCreateParty, useMethods, useParties } from '../../hooks/useFinance'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { usePartners } from '../../hooks/usePartners'
import { useStudents } from '../../hooks/useStudents'
import { planInstallments, type Periodicity } from '../../utils/installments'
import { formatCents, sumCents, toCents } from '../../utils/money'
import { addDays, todayInTimeZone } from '../../utils/timezone'
import type { Entry, EntryType } from '../../types/finance'
import { loadLastUsed } from '../../utils/financeLastUsed'

type Props = {
  organizationId: number
  timezone: string
  type: EntryType
  // Quando o lançamento nasce de um aluno/matrícula (contexto)
  preset?: { studentId?: number; studentName?: string; enrollmentId?: number; description?: string }
  // Repetir um lançamento: copia descrição, categoria, valor e pessoa; datas e baixas começam do zero
  copyFrom?: Entry
  onClose: () => void
}

// Nova receita ou despesa: valor, parcelas revisáveis (datas e valores) e, se já foi pago, a baixa no mesmo passo
export function EntryFormModal({ organizationId, timezone, type, preset, copyFrom, onClose }: Props) {
  const receivable = type === 'receivable'
  const today = todayInTimeZone(timezone)
  const categories = useCategories(organizationId)
  const accounts = useAccounts(organizationId)
  const methods = useMethods(organizationId)
  const parties = useParties(organizationId)
  const partners = usePartners(organizationId, { page: 1, all: true })
  const create = useCreateEntry(organizationId)
  const createParty = useCreateParty(organizationId)
  const last = useMemo(() => loadLastUsed(organizationId, type), [organizationId, type])

  const [description, setDescription] = useState(copyFrom?.description ?? preset?.description ?? '')
  const [categoryId, setCategoryId] = useState(copyFrom ? String(copyFrom.category.id) : '')
  const [total, setTotal] = useState(copyFrom ? String(copyFrom.total_cents / 100) : '')
  const [issuedOn, setIssuedOn] = useState(today)
  const [count, setCount] = useState('1')
  const [firstDue, setFirstDue] = useState(today)
  const [periodicity, setPeriodicity] = useState<Periodicity>('monthly')
  // Parcelas ajustadas à mão; some ao mudar valor, quantidade, primeiro vencimento ou periodicidade
  const [edited, setEdited] = useState<Array<{ due_date: string; amount: string }> | null>(null)
  const [studentText, setStudentText] = useState('')
  const studentSearch = useDebouncedValue(studentText.trim())
  const students = useStudents(organizationId, { search: studentSearch, page: 1 })
  const [studentId, setStudentId] = useState(copyFrom?.student ? String(copyFrom.student.id) : preset?.studentId ? String(preset.studentId) : '')
  const [partnerId, setPartnerId] = useState(copyFrom?.partner ? String(copyFrom.partner.id) : '')
  const [partyId, setPartyId] = useState(copyFrom?.party ? String(copyFrom.party.id) : '')
  const [newParty, setNewParty] = useState('')
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [paid, setPaid] = useState({ account_id: String(last.account_id ?? ''), method_id: String(last.method_id ?? ''), paid_on: today })
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const totalCents = toCents(total)
  const wanted = Math.max(1, Number(count) || 1)

  const planned = useMemo(
    () => planInstallments(totalCents, wanted, firstDue, periodicity).map((row) => ({ due_date: row.due_date, amount: String(row.amount_cents / 100) })),
    [totalCents, wanted, firstDue, periodicity],
  )
  const rows = edited ?? planned
  const setRows = (change: (current: typeof rows) => typeof rows) => setEdited(change(rows))

  const rowsTotal = sumCents(rows.map((row) => toCents(row.amount)))
  const diff = totalCents - rowsTotal
  const categoryOptions = (categories.data ?? []).filter((c) => c.active && c.type === (receivable ? 'income' : 'expense'))

  const protection = useDraftProtection({ description, categoryId, total, issuedOn, count, firstDue, periodicity, edited, studentId, partnerId, partyId, newParty, alreadyPaid, paid, notes }, onClose, create.isPending || createParty.isPending)

  const submit = async () => {
    setError(null)
    if (description.trim().length < 3) return setError('Descreva o lançamento (mín. 3 letras).')
    if (!categoryId) return setError('Escolha a categoria.')
    if (totalCents < 1) return setError('Informe o valor total.')
    if (receivable && !studentId && !partnerId) return setError('Informe quem paga: o aluno ou a auto escola parceira.')
    if (diff !== 0) return setError(`A soma das parcelas precisa fechar o total: ${diff > 0 ? 'faltam' : 'sobram'} ${formatCents(Math.abs(diff))}.`)
    if (alreadyPaid && (!paid.account_id || !paid.method_id)) return setError('Para registrar como já pago, escolha a conta e a forma de pagamento.')

    let payee = partyId ? Number(partyId) : null
    try {
      if (!receivable && !payee && newParty.trim().length >= 2) payee = (await createParty.mutateAsync({ name: newParty.trim() })).id
    } catch (e) {
      return setError((e as Error).message)
    }

    create.mutate(
      {
        type,
        description: description.trim(),
        category_id: Number(categoryId),
        student_id: receivable && studentId ? Number(studentId) : null,
        partner_id: partnerId ? Number(partnerId) : null,
        party_id: !receivable ? payee : null,
        enrollment_id: preset?.enrollmentId ?? null,
        total_cents: totalCents,
        issued_on: issuedOn,
        installments: rows.map((row) => ({ due_date: row.due_date, amount_cents: toCents(row.amount) })),
        paid: alreadyPaid ? { account_id: Number(paid.account_id), method_id: Number(paid.method_id), paid_on: paid.paid_on } : undefined,
        notes: notes.trim() || null,
      },
      { onSuccess: () => { protection.saved(); onClose() }, onError: (e) => setError(e.message) },
    )
  }

  return (
    <Modal show onHide={protection.close} centered size="lg" fullscreen="md-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          {copyFrom ? 'Repetir lançamento' : receivable ? 'Nova receita' : 'Nova despesa'}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && (
          <Alert variant="danger" role="alert">
            {error}
          </Alert>
        )}

        <Form.Group className="mb-3" controlId="entry-description">
          <Form.Label>Descrição</Form.Label>
          <Form.Control value={description} autoFocus placeholder={receivable ? 'Ex.: Pacote de 20 aulas' : 'Ex.: Troca de óleo'} onChange={(event) => setDescription(event.target.value)} />
        </Form.Group>

        <Row className="g-3 mb-3">
          <Col sm={6}>
            <Form.Label htmlFor="entry-category">Categoria</Form.Label>
            <Form.Select id="entry-category" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Escolha</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Form.Select>
          </Col>
          <Col sm={6}>
            <Form.Label htmlFor="entry-total">Valor total</Form.Label>
            <NumericFormat
              id="entry-total"
              customInput={BootstrapInput}
              inputMode="decimal"
              prefix="R$ "
              thousandSeparator="."
              decimalSeparator=","
              decimalScale={2}
              fixedDecimalScale
              allowNegative={false}
              value={total}
              valueIsNumericString
              onValueChange={(values) => { setTotal(values.value); setEdited(null) }}
            />
          </Col>
        </Row>

        {receivable ? (
          <Row className="g-3 mb-3">
            <Col sm={6}>
              <Form.Label htmlFor="entry-student-search">Aluno (quem recebe as aulas)</Form.Label>
              {preset?.studentName || copyFrom?.student ? (
                <Form.Control readOnly value={preset?.studentName ?? copyFrom?.student?.name ?? ''} />
              ) : (
                <>
                  <Form.Control id="entry-student-search" type="search" placeholder="Digite o nome para buscar" value={studentText} onChange={(event) => setStudentText(event.target.value)} />
                  <Form.Select aria-label="Resultado da busca de alunos" className="mt-1" value={studentId} onChange={(event) => setStudentId(event.target.value)}>
                    <option value="">{students.isPending ? 'Buscando…' : 'Escolha o aluno'}</option>
                    {students.data?.data.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </Form.Select>
                </>
              )}
            </Col>
            <Col sm={6}>
              <Form.Label htmlFor="entry-partner">O pagador é uma auto escola parceira?</Form.Label>
              <Form.Select id="entry-partner" value={partnerId} onChange={(event) => setPartnerId(event.target.value)}>
                <option value="">Não, o próprio aluno paga</option>
                {partners.data?.data.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Form.Select>
            </Col>
          </Row>
        ) : (
          <Row className="g-3 mb-3">
            <Col sm={6}>
              <Form.Label htmlFor="entry-party">Favorecido ou fornecedor</Form.Label>
              <Form.Select id="entry-party" value={partyId} onChange={(event) => setPartyId(event.target.value)}>
                <option value="">Outro (cadastrar abaixo)</option>
                {parties.data?.filter((p) => p.active).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col sm={6}>
              <Form.Label htmlFor="entry-new-party">Novo favorecido (opcional)</Form.Label>
              <Form.Control id="entry-new-party" disabled={partyId !== ''} placeholder="Nome da oficina, posto, etc." value={newParty} onChange={(event) => setNewParty(event.target.value)} />
            </Col>
          </Row>
        )}

        {Number(count) === 1 && <Form.Group controlId="entry-single-due" className="mb-3"><Form.Label>Vencimento</Form.Label><Form.Control type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} /></Form.Group>}
        <Form.Check type="switch" id="entry-installments" label="Parcelar este valor" className="mb-3" checked={Number(count) > 1} onChange={(e) => { setCount(e.target.checked ? '2' : '1'); setEdited(null) }} />
        <fieldset hidden={Number(count) === 1} className="border rounded p-3 mb-3">
          <legend className="fs-6 float-none w-auto px-2 mb-0">Parcelas</legend>
          <Row className="g-2 align-items-end">
            <Col xs={4} sm={3}>
              <Form.Label htmlFor="entry-count" className="small mb-1">Quantidade</Form.Label>
              <Form.Control id="entry-count" inputMode="numeric" value={count} onChange={(event) => { setCount(event.target.value.replace(/\D/g, '').slice(0, 3)); setEdited(null) }} />
            </Col>
            <Col xs={8} sm={4}>
              <Form.Label htmlFor="entry-first" className="small mb-1">Primeiro vencimento</Form.Label>
              <Form.Control id="entry-first" type="date" value={firstDue} onChange={(event) => { setFirstDue(event.target.value); setEdited(null) }} />
            </Col>
            <Col xs={12} sm={5}>
              <Form.Label htmlFor="entry-period" className="small mb-1">Periodicidade</Form.Label>
              <Form.Select id="entry-period" value={periodicity} onChange={(event) => { setPeriodicity(event.target.value as Periodicity); setEdited(null) }}>
                {Object.entries(PERIODICITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Form.Select>
            </Col>
          </Row>
          {rows.length > 0 && (
            <div className="table-responsive mt-3">
              <Table size="sm" className="align-middle mb-1">
                <caption className="visually-hidden">Parcelas do lançamento; você pode ajustar datas e valores</caption>
                <thead>
                  <tr>
                    <th scope="col">Parcela</th>
                    <th scope="col">Vencimento</th>
                    <th scope="col">Valor (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index}>
                      <td>{index + 1}/{rows.length}</td>
                      <td>
                        <Form.Control size="sm" type="date" aria-label={`Vencimento da parcela ${index + 1}`} value={row.due_date} onChange={(event) => setRows((current) => current.map((r, i) => (i === index ? { ...r, due_date: event.target.value } : r)))} />
                      </td>
                      <td>
                        <MoneyInput size="sm" aria-label={`Valor da parcela ${index + 1}`} value={row.amount} onValueChange={(value) => setRows((current) => current.map((r, i) => (i === index ? { ...r, amount: value } : r)))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className={`small ${diff === 0 ? 'text-success' : 'text-danger'}`} aria-live="polite">
                {diff === 0 ? `Soma das parcelas: ${formatCents(rowsTotal)} — fecha com o total.` : `Soma ${formatCents(rowsTotal)}: ${diff > 0 ? 'faltam' : 'sobram'} ${formatCents(Math.abs(diff))} para fechar o total.`}
              </div>
            </div>
          )}
          <Button variant="link" size="sm" className="px-0 mt-1" onClick={() => { setFirstDue(addDays(today, 30)); setEdited(null) }}>
            Primeiro vencimento em 30 dias
          </Button>
        </fieldset>

        <Form.Check type="switch" id="entry-paid" className="mb-2" label={receivable ? 'Já recebi este valor' : 'Já paguei este valor'} checked={alreadyPaid} onChange={(event) => setAlreadyPaid(event.target.checked)} />
        {alreadyPaid && (
          <Row className="g-2 mb-3">
            <Col sm={4}>
              <Form.Label htmlFor="paid-method" className="small mb-1">Forma</Form.Label>
              <Form.Select id="paid-method" value={paid.method_id} onChange={(event) => setPaid({ ...paid, method_id: event.target.value })}>
                <option value="">Escolha</option>
                {methods.data?.filter((m) => m.active && m.settlement_days === 0).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col sm={4}>
              <Form.Label htmlFor="paid-account" className="small mb-1">Conta</Form.Label>
              <Form.Select id="paid-account" value={paid.account_id} onChange={(event) => setPaid({ ...paid, account_id: event.target.value })}>
                <option value="">Escolha</option>
                {accounts.data?.filter((a) => a.active).map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Form.Select>
            </Col>
            <Col sm={4}>
              <Form.Label htmlFor="paid-date" className="small mb-1">Data</Form.Label>
              <Form.Control id="paid-date" type="date" max={today} value={paid.paid_on} onChange={(event) => setPaid({ ...paid, paid_on: event.target.value })} />
            </Col>
          </Row>
        )}

        <Row className="g-3">
          <Col sm={4}>
            <Form.Label htmlFor="entry-issued" className="small mb-1">Data do lançamento</Form.Label>
            <Form.Control id="entry-issued" type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} />
          </Col>
          <Col sm={8}>
            <Form.Label htmlFor="entry-notes" className="small mb-1">Observação (opcional)</Form.Label>
            <Form.Control id="entry-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={protection.close} disabled={create.isPending}>
          Cancelar
        </Button>
        <Button onClick={() => void submit()} disabled={create.isPending || createParty.isPending}>
          Salvar {receivable ? 'receita' : 'despesa'}
        </Button>
      </Modal.Footer>
    </Modal>
  )
}
