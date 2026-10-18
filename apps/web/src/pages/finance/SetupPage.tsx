import { RecordSection } from '../../components/RecordSection'
import { useState } from 'react'
import { Alert, Badge, Button, Card, Col, Form, Row } from 'react-bootstrap'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { METHOD_KIND_LABELS } from '../../config/finance'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import {
  useCategories, useCreateCategory, useCreateMethod, useCreateParty, useCreateRecurrence, useMethods, useParties, useRecurrences, useStopRecurrence, useUpdateCategory, useUpdateMethod, useUpdateParty,
} from '../../hooks/useFinance'
import { usePartners } from '../../hooks/usePartners'
import { useStudents } from '../../hooks/useStudents'
import type { PaymentMethodKind } from '../../types/finance'
import { formatDate } from '../../utils/formatDate'
import { formatCents, toCents } from '../../utils/money'
import { canManageMembers } from '../../utils/permissions'
import { todayInTimeZone } from '../../utils/timezone'

function useMutationError() {
  const [error, setError] = useState<string | null>(null)
  return [error, { onSuccess: () => setError(null), onError: (e: Error) => setError(e.message) }, setError] as const
}

// Cadastros simples do financeiro: categorias, formas de pagamento, favorecidos e recorrências mensais
export default function SetupPage() {
  const organization = useActiveOrganization()
  const manage = canManageMembers(organization.role)

  return (
    <>
      <PageHeader title="Cadastros do financeiro" subtitle="Categorias, formas de pagamento, favorecidos e lançamentos que se repetem todo mês." />
      {!manage && <Alert variant="info">Categorias, formas de pagamento e recorrências são alteradas por proprietários e gestores. Você pode cadastrar favorecidos.</Alert>}
      {manage ? <Row className="g-4">
        <Col lg={6}><Categories organizationId={organization.id} manage /></Col>
        <Col lg={6}><Methods organizationId={organization.id} manage /></Col>
        <Col lg={6}><Parties organizationId={organization.id} /></Col>
        <Col lg={6}><Recurrences organizationId={organization.id} timezone={organization.timezone} manage /></Col>
      </Row> : <>
        <div className="mb-4"><Parties organizationId={organization.id} /></div>
        <RecordSection title="Consultar categorias e formas de pagamento"><Row className="g-4"><Col lg={6}><Categories organizationId={organization.id} manage={false} /></Col><Col lg={6}><Methods organizationId={organization.id} manage={false} /></Col></Row></RecordSection>
        <RecordSection title="Consultar recorrências"><Recurrences organizationId={organization.id} timezone={organization.timezone} manage={false} /></RecordSection>
      </>}

    </>
  )
}

function Categories({ organizationId, manage }: { organizationId: number; manage: boolean }) {
  const query = useCategories(organizationId)
  const create = useCreateCategory(organizationId)
  const update = useUpdateCategory(organizationId)
  const [name, setName] = useState('')
  const [type, setType] = useState<'income' | 'expense'>('income')
  const [pass, setPass] = useState(false)
  const [error, handlers] = useMutationError()

  return (
    <Card className="h-100">
      <Card.Body>
        <Card.Title as="h2" className="h5">Categorias</Card.Title>
        <QueryState query={query} isEmpty={() => false} empty={null}>
          {(data) => (
            <ul className="list-unstyled d-grid gap-1">
              {data.map((c) => (
                <li key={c.id} className="d-flex flex-wrap justify-content-between gap-2">
                  <span className={c.active ? undefined : 'text-secondary'}>
                    <Badge bg={c.type === 'income' ? 'success' : 'secondary'} className="me-2">{c.type === 'income' ? 'Receita' : 'Despesa'}</Badge>
                    {c.name}
                    {c.is_pass_through && <Badge bg="info" className="ms-2" title="Movimenta o caixa, mas não é faturamento">Repasse</Badge>}
                  </span>
                  {manage && <Button size="sm" variant="link" className="p-0" onClick={() => update.mutate({ categoryId: c.id, active: !c.active })}>{c.active ? 'Inativar' : 'Reativar'}</Button>}
                </li>
              ))}
            </ul>
          )}
        </QueryState>
        {manage && (
          <>
            {error && <Alert variant="danger" className="py-1 small" role="alert">{error}</Alert>}
            <Row className="g-2 align-items-end">
              <Col xs={12} sm={5}><Form.Label htmlFor="cat-name" className="small mb-1">Nova categoria</Form.Label><Form.Control id="cat-name" value={name} onChange={(event) => setName(event.target.value)} /></Col>
              <Col xs={6} sm={3}><Form.Select aria-label="Tipo da categoria" value={type} onChange={(event) => setType(event.target.value as 'income' | 'expense')}><option value="income">Receita</option><option value="expense">Despesa</option></Form.Select></Col>
              <Col xs={6} sm={4}><Button className="w-100" disabled={name.trim().length < 2 || create.isPending} onClick={() => create.mutate({ name: name.trim(), type, is_pass_through: pass }, { ...handlers, onSuccess: () => { handlers.onSuccess(); setName('') } })}>Adicionar</Button></Col>
            </Row>
            <Form.Check type="checkbox" id="cat-pass" className="mt-2 small" label="É repasse ou reembolso (não conta como faturamento)" checked={pass} onChange={(event) => setPass(event.target.checked)} />
          </>
        )}
      </Card.Body>
    </Card>
  )
}

function Methods({ organizationId, manage }: { organizationId: number; manage: boolean }) {
  const query = useMethods(organizationId)
  const create = useCreateMethod(organizationId)
  const update = useUpdateMethod(organizationId)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<PaymentMethodKind>('other')
  const [days, setDays] = useState('0')
  const [error, handlers] = useMutationError()

  return (
    <Card className="h-100">
      <Card.Body>
        <Card.Title as="h2" className="h5">Formas de pagamento</Card.Title>
        <p className="small text-secondary">Com “dias para liquidar” maior que zero (cartão, boleto), o valor fica como previsão até você confirmar que o dinheiro chegou.</p>
        <QueryState query={query} isEmpty={() => false} empty={null}>
          {(data) => (
            <ul className="list-unstyled d-grid gap-1">
              {data.map((m) => (
                <li key={m.id} className="d-flex flex-wrap justify-content-between gap-2">
                  <span className={m.active ? undefined : 'text-secondary'}>
                    {m.name} <span className="small text-secondary">({METHOD_KIND_LABELS[m.kind]}{m.settlement_days > 0 ? `, liquida em ${m.settlement_days} dias` : ''})</span>
                  </span>
                  {manage && <Button size="sm" variant="link" className="p-0" onClick={() => update.mutate({ methodId: m.id, active: !m.active })}>{m.active ? 'Inativar' : 'Reativar'}</Button>}
                </li>
              ))}
            </ul>
          )}
        </QueryState>
        {manage && (
          <>
            {error && <Alert variant="danger" className="py-1 small" role="alert">{error}</Alert>}
            <Row className="g-2 align-items-end">
              <Col xs={12} sm={4}><Form.Label htmlFor="met-name" className="small mb-1">Nova forma</Form.Label><Form.Control id="met-name" value={name} onChange={(event) => setName(event.target.value)} /></Col>
              <Col xs={6} sm={3}><Form.Select aria-label="Tipo da forma" value={kind} onChange={(event) => setKind(event.target.value as PaymentMethodKind)}>{Object.entries(METHOD_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Form.Select></Col>
              <Col xs={6} sm={2}><Form.Control aria-label="Dias para liquidar" inputMode="numeric" value={days} onChange={(event) => setDays(event.target.value.replace(/\D/g, ''))} /></Col>
              <Col xs={12} sm={3}><Button className="w-100" disabled={name.trim().length < 2 || create.isPending} onClick={() => create.mutate({ name: name.trim(), kind, settlement_days: Number(days) || 0 }, { ...handlers, onSuccess: () => { handlers.onSuccess(); setName('') } })}>Adicionar</Button></Col>
            </Row>
          </>
        )}
      </Card.Body>
    </Card>
  )
}

function Parties({ organizationId }: { organizationId: number }) {
  const [search, setSearch] = useState('')
  const query = useParties(organizationId, search)
  const create = useCreateParty(organizationId)
  const update = useUpdateParty(organizationId)
  const [name, setName] = useState('')
  const [error, handlers] = useMutationError()

  return (
    <Card className="h-100">
      <Card.Body>
        <Card.Title as="h2" className="h5">Favorecidos e fornecedores</Card.Title>
        <Form.Control type="search" aria-label="Buscar favorecido" placeholder="Buscar" className="mb-2" value={search} onChange={(event) => setSearch(event.target.value)} />
        <QueryState query={query} isEmpty={(d) => d.length === 0} empty="Nenhum favorecido cadastrado.">
          {(data) => (
            <ul className="list-unstyled d-grid gap-1">
              {data.map((p) => (
                <li key={p.id} className="d-flex flex-wrap justify-content-between gap-2">
                  <span className={p.active ? undefined : 'text-secondary'}>{p.name}{p.document && <span className="small text-secondary"> · {p.document}</span>}</span>
                  <Button size="sm" variant="link" className="p-0" onClick={() => update.mutate({ partyId: p.id, active: !p.active })}>{p.active ? 'Inativar' : 'Reativar'}</Button>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
        {error && <Alert variant="danger" className="py-1 small" role="alert">{error}</Alert>}
        <Row className="g-2 align-items-end">
          <Col xs={8}><Form.Label htmlFor="party-name" className="small mb-1">Novo favorecido</Form.Label><Form.Control id="party-name" placeholder="Oficina, posto, locador…" value={name} onChange={(event) => setName(event.target.value)} /></Col>
          <Col xs={4}><Button className="w-100" disabled={name.trim().length < 2 || create.isPending} onClick={() => create.mutate({ name: name.trim() }, { ...handlers, onSuccess: () => { handlers.onSuccess(); setName('') } })}>Adicionar</Button></Col>
        </Row>
      </Card.Body>
    </Card>
  )
}

function Recurrences({ organizationId, timezone, manage }: { organizationId: number; timezone: string; manage: boolean }) {
  const query = useRecurrences(organizationId)
  const categories = useCategories(organizationId)
  const parties = useParties(organizationId)
  const partners = usePartners(organizationId, { page: 1, all: true })
  const [studentText, setStudentText] = useState('')
  const students = useStudents(organizationId, { search: studentText.trim(), page: 1 })
  const create = useCreateRecurrence(organizationId)
  const stop = useStopRecurrence(organizationId)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ type: 'payable', description: '', category_id: '', party_id: '', partner_id: '', student_id: '', amount: '', day: '5', starts_on: todayInTimeZone(timezone) })
  const [error, handlers] = useMutationError()

  return (
    <Card className="h-100">
      <Card.Body>
        <Card.Title as="h2" className="h5">Lançamentos que se repetem</Card.Title>
        <p className="small text-secondary">Gera um lançamento por mês (aluguel, mensalidade…). Reprocessar nunca duplica.</p>
        <QueryState query={query} isEmpty={(d) => d.length === 0} empty="Nenhuma recorrência.">
          {(data) => (
            <ul className="list-unstyled d-grid gap-1">
              {data.map((r) => (
                <li key={r.id} className="d-flex flex-wrap justify-content-between gap-2">
                  <span className={r.active ? undefined : 'text-secondary'}>
                    <Badge bg={r.type === 'receivable' ? 'success' : 'secondary'} className="me-2">{r.type === 'receivable' ? 'Receita' : 'Despesa'}</Badge>
                    {r.description} · {formatCents(r.amount_cents)} · dia {r.day_of_month} <span className="small text-secondary">desde {formatDate(r.starts_on)}</span>
                  </span>
                  {manage && r.active && <Button size="sm" variant="link" className="p-0 text-danger" onClick={() => stop.mutate(r.id)}>Encerrar</Button>}
                </li>
              ))}
            </ul>
          )}
        </QueryState>
        {manage && !open && <Button variant="outline-primary" size="sm" onClick={() => setOpen(true)}>Nova recorrência</Button>}
        {manage && open && (
          <div className="border rounded p-3">
            {error && <Alert variant="danger" className="py-1 small" role="alert">{error}</Alert>}
            <Row className="g-2">
              <Col xs={6}><Form.Select aria-label="Tipo" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value, category_id: '' })}><option value="payable">Despesa</option><option value="receivable">Receita</option></Form.Select></Col>
              <Col xs={6}><Form.Select aria-label="Categoria" value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}><option value="">Categoria</option>{categories.data?.filter((c) => c.active && c.type === (form.type === 'payable' ? 'expense' : 'income')).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Form.Select></Col>
              <Col xs={12}><Form.Control aria-label="Descrição" placeholder="Descrição" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Col>
              {form.type === 'payable' ? (
                <Col xs={12}><Form.Select aria-label="Favorecido" value={form.party_id} onChange={(event) => setForm({ ...form, party_id: event.target.value })}><option value="">Favorecido (opcional)</option>{parties.data?.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Form.Select></Col>
              ) : (
                <>
                  <Col xs={12} sm={6}><Form.Control type="search" aria-label="Buscar aluno" placeholder="Buscar aluno" value={studentText} onChange={(event) => setStudentText(event.target.value)} /><Form.Select aria-label="Aluno" className="mt-1" value={form.student_id} onChange={(event) => setForm({ ...form, student_id: event.target.value })}><option value="">Aluno</option>{students.data?.data.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Form.Select></Col>
                  <Col xs={12} sm={6}><Form.Select aria-label="Parceiro pagador" value={form.partner_id} onChange={(event) => setForm({ ...form, partner_id: event.target.value })}><option value="">Parceiro pagador (opcional)</option>{partners.data?.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Form.Select></Col>
                </>
              )}
              <Col xs={4}><Form.Control aria-label="Valor (R$)" inputMode="decimal" placeholder="Valor R$" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value.replace(',', '.') })} /></Col>
              <Col xs={3}><Form.Control aria-label="Dia do mês" inputMode="numeric" placeholder="Dia" value={form.day} onChange={(event) => setForm({ ...form, day: event.target.value.replace(/\D/g, '').slice(0, 2) })} /></Col>
              <Col xs={5}><Form.Control aria-label="Começa em" type="date" value={form.starts_on} onChange={(event) => setForm({ ...form, starts_on: event.target.value })} /></Col>
            </Row>
            <div className="d-flex gap-2 mt-2">
              <Button
                size="sm"
                disabled={create.isPending || !form.category_id || form.description.trim().length < 3 || toCents(form.amount) < 1}
                onClick={() =>
                  create.mutate(
                    {
                      type: form.type, description: form.description.trim(), category_id: Number(form.category_id), amount_cents: toCents(form.amount), day_of_month: Number(form.day) || 1, starts_on: form.starts_on,
                      party_id: form.party_id ? Number(form.party_id) : null, partner_id: form.partner_id ? Number(form.partner_id) : null, student_id: form.student_id ? Number(form.student_id) : null,
                    },
                    { ...handlers, onSuccess: () => { handlers.onSuccess(); setOpen(false) } },
                  )
                }
              >
                Criar recorrência
              </Button>
              <Button size="sm" variant="link" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          </div>
        )}
      </Card.Body>
    </Card>
  )
}
