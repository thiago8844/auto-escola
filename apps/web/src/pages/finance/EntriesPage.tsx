import { useState } from 'react'
import { Button, Col, Form, Row } from 'react-bootstrap'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { SITUATION, SITUATION_ORDER } from '../../config/finance'
import { PAGE_SIZE } from '../../config/organization'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useAccounts, useCategories, useExportCsv, useFinanceInstallments, useMethods } from '../../hooks/useFinance'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import { useUrlFilters, useUrlSearch } from '../../hooks/useUrlFilters'
import type { EntryType, Installment, Situation } from '../../types/finance'
import { formatDate } from '../../utils/formatDate'
import { formatCents } from '../../utils/money'
import { canManageMembers } from '../../utils/permissions'
import { EntryDetailModal } from './EntryDetailModal'
import { EntryFormModal } from './EntryFormModal'
import { PayModal } from './PayModal'
import { Money, SituationBadge } from './shared'

// Receitas (a receber) e despesas (a pagar) na mesma tela: filtros na URL, totais por situação e ação direta de baixa
export default function EntriesPage({ type }: { type: EntryType }) {
  const organization = useActiveOrganization()
  const receivable = type === 'receivable'
  const [page, setPage] = usePageParam()
  const [text, setText, search] = useUrlSearch('q')
  const { values, set, clear, active } = useUrlFilters(['situacao', 'de', 'ate', 'categoria', 'conta', 'forma', 'lancamento'] as const)
  const [creating, setCreating] = useState(false)
  const [paying, setPaying] = useState<Installment | null>(null)
  const openEntry = Number(values.lancamento) > 0 ? Number(values.lancamento) : null
  const setOpenEntry = (id: number | null) => set('lancamento', id === null ? '' : String(id))

  const categories = useCategories(organization.id)
  const accounts = useAccounts(organization.id)
  const methods = useMethods(organization.id)
  const exportCsv = useExportCsv(organization.id)

  const filters = {
    type,
    situation: values.situacao,
    from: values.de,
    to: values.ate,
    category_id: values.categoria,
    account_id: values.conta,
    method_id: values.forma,
    q: search,
  }
  const query = useFinanceInstallments(organization.id, { ...filters, page })
  useClampPage(page, query.data?.meta.last_page, setPage)
  const rangeInvalid = values.de !== '' && values.ate !== '' && values.ate < values.de
  const selected = values.situacao ? values.situacao.split(',') : []
  const toggleSituation = (situation: Situation) => set('situacao', selected.length === 1 && selected[0] === situation ? '' : situation)

  return (
    <>
      <PageHeader
        title={receivable ? 'Receitas' : 'Despesas'}
        subtitle={receivable ? 'O que o espaço tem a receber: contratações, acréscimos e serviços avulsos.' : 'O que o espaço tem a pagar: manutenção, combustível, aluguel e outros.'}
        actions={
          <>
            <Button variant="outline-secondary" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate({ what: 'installments', params: filters })}>
              <i className="bi bi-filetype-csv me-2" aria-hidden="true" />
              Exportar CSV
            </Button>
            <Button onClick={() => setCreating(true)}>
              <i className="bi bi-plus-lg me-2" aria-hidden="true" />
              {receivable ? 'Nova receita' : 'Nova despesa'}
            </Button>
          </>
        }
      />

      <form className="mb-3" onSubmit={(event) => event.preventDefault()} aria-label="Filtros">
        <Row className="g-2">
          <Col md={4}>
            <Form.Label htmlFor="fin-search" className="small mb-1">Buscar</Form.Label>
            <Form.Control id="fin-search" type="search" placeholder={receivable ? 'Descrição, aluno ou parceiro' : 'Descrição ou favorecido'} value={text} onChange={(event) => setText(event.target.value)} />
          </Col>
          <Col xs={6} md={2}>
            <Form.Label htmlFor="fin-from" className="small mb-1">Vencimento de</Form.Label>
            <Form.Control id="fin-from" type="date" value={values.de} isInvalid={rangeInvalid} onChange={(event) => set('de', event.target.value)} />
          </Col>
          <Col xs={6} md={2}>
            <Form.Label htmlFor="fin-to" className="small mb-1">até</Form.Label>
            <Form.Control id="fin-to" type="date" value={values.ate} isInvalid={rangeInvalid} onChange={(event) => set('ate', event.target.value)} />
          </Col>
        </Row>
        <details className="mt-2" open={Boolean(values.categoria || values.forma || values.conta)}>
          <summary className="text-primary py-2">Mais filtros{[values.categoria, values.forma, values.conta].filter(Boolean).length > 0 ? ` · ${[values.categoria, values.forma, values.conta].filter(Boolean).length} ativos` : ''}</summary>
          <Row className="g-2 mt-1">
          <Col xs={6} md={2}>
            <Form.Label htmlFor="fin-category" className="small mb-1">Categoria</Form.Label>
            <Form.Select id="fin-category" value={values.categoria} onChange={(event) => set('categoria', event.target.value)}>
              <option value="">Todas</option>
              {categories.data?.filter((c) => c.type === (receivable ? 'income' : 'expense')).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Form.Select>
          </Col>
          <Col xs={6} md={2}>
            <Form.Label htmlFor="fin-method" className="small mb-1">Forma</Form.Label>
            <Form.Select id="fin-method" value={values.forma} onChange={(event) => set('forma', event.target.value)}>
              <option value="">Todas</option>
              {methods.data?.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Form.Select>
          </Col>
          <Col xs={6} md={3}>
            <Form.Label htmlFor="fin-account" className="small mb-1">Conta</Form.Label>
            <Form.Select id="fin-account" value={values.conta} onChange={(event) => set('conta', event.target.value)}>
              <option value="">Todas</option>
              {accounts.data?.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Form.Select>
          </Col>
          </Row>
        </details>
        {(active || search !== '') && (
          <Button variant="link" size="sm" className="px-0 mt-2" onClick={() => { setText(''); clear() }}>
            Limpar filtros
          </Button>
        )}
      </form>
      {rangeInvalid && <p className="small text-danger">A data final não pode ser anterior à inicial.</p>}

      {query.data && (
        <div className="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Filtrar por situação">
          {SITUATION_ORDER.map((situation) => {
            const totals = query.data.totals.by_situation[situation]
            const isOn = selected.includes(situation)
            return (
              <Button key={situation} size="sm" variant={isOn ? SITUATION[situation].bg : 'outline-secondary'} aria-pressed={isOn} onClick={() => toggleSituation(situation)}>
                <i className={`bi ${SITUATION[situation].icon} me-1`} aria-hidden="true" />
                {SITUATION[situation].label} · {totals.count}
                {situation !== 'paid' && situation !== 'cancelled' && totals.outstanding_cents > 0 && <span className="ms-1">({formatCents(totals.outstanding_cents)})</span>}
              </Button>
            )
          })}
        </div>
      )}

      {!rangeInvalid && (
        <QueryState
          query={query}
          isEmpty={(data) => data.data.length === 0}
          empty={active || search ? 'Nada encontrado com estes filtros.' : receivable ? 'Nenhuma receita lançada ainda. Use “Nova receita” ou cobre a contratação direto na matrícula.' : 'Nenhuma despesa lançada ainda. Use “Nova despesa” ou lance a manutenção direto no veículo.'}
        >
          {(data) => (
            <>
              <p className="small text-secondary" aria-live="polite">
                {data.meta.total} {data.meta.total === 1 ? 'parcela' : 'parcelas'} · total <Money cents={data.totals.amount_cents} /> · em aberto <Money cents={data.totals.outstanding_cents} strong />
              </p>
              <DataTable
                rows={data.data}
                getKey={(row) => row.id}
                columns={[
                  { header: 'Vencimento', primary: true, cell: (row) => <span className="tabular-nums">{formatDate(row.due_date)}</span> },
                  {
                    header: receivable ? 'Descrição e pagador' : 'Descrição e favorecido',
                    cell: (row) => (
                      <button type="button" className="btn btn-link p-0 text-start text-decoration-none" onClick={() => setOpenEntry(row.entry_id)}>
                        {row.entry?.description}
                        <span className="d-block small text-secondary fw-normal">{row.entry?.partner?.name ?? row.entry?.student?.name ?? row.entry?.party?.name ?? row.entry?.category.name}</span>
                      </button>
                    ),
                  },
                  { header: 'Parcela', cell: (row) => <span className="tabular-nums">{row.number}/{row.entry?.installments_count}</span> },
                  { header: 'Valor', cell: (row) => <Money cents={row.amount_cents} /> },
                  { header: 'Em aberto', cell: (row) => <Money cents={row.outstanding_cents} strong /> },
                  { header: 'Situação', cell: (row) => <SituationBadge situation={row.situation} pendingCents={row.awaiting_settlement_cents} /> },
                  {
                    header: 'Ações',
                    actions: true,
                    cell: (row, { mobile }) => (
                      <>
                        {row.outstanding_cents > 0 && (
                          <Button size={mobile ? undefined : 'sm'} className={mobile ? 'flex-fill' : 'me-2'} onClick={() => setPaying(row)}>
                            {receivable ? 'Receber' : 'Pagar'}
                          </Button>
                        )}
                        <Button size={mobile ? undefined : 'sm'} variant="outline-secondary" className={mobile ? 'flex-fill' : undefined} onClick={() => setOpenEntry(row.entry_id)}>
                          Detalhes
                        </Button>
                      </>
                    ),
                  },
                ]}
              />
              <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </QueryState>
      )}

      {creating && <EntryFormModal organizationId={organization.id} timezone={organization.timezone} type={type} onClose={() => setCreating(false)} />}
      {paying && <PayModal organizationId={organization.id} timezone={organization.timezone} installment={paying} onClose={() => setPaying(null)} />}
      {openEntry !== null && (
        <EntryDetailModal organizationId={organization.id} timezone={organization.timezone} entryId={openEntry} canManage={canManageMembers(organization.role)} onClose={() => { setOpenEntry(null); set('lancamento', '') }} />
      )}
    </>
  )
}
