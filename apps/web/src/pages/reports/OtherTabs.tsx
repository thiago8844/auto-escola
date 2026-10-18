import { Badge, Button, Col, Form, ProgressBar, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { DataTable } from '../../components/DataTable'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { ExamStatusBadge } from '../../components/StatusBadges'
import { EXAM_STATUS, ISSUANCE_STATUS, PROCESS_STATUS, FEE_STATUS } from '../../config/domain'
import { organizationPaths } from '../../config/paths'
import { useExamDetail, useExamsReport, useExportReport, usePartnersReport, useProcessesReport, useUtilizationReport } from '../../hooks/useReports'
import type { Organization } from '../../types/organization'
import type { ApprovalRate, ExamRow, ResourceUtilization } from '../../types/reports'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDateTime } from '../../utils/formatDateTime'
import { formatMinutes } from '../../utils/formatMinutes'
import { Stat } from './ReportFilters'

type TabProps = { organization: Organization; from: string; to: string }

const rate = (r: ApprovalRate) => (r.percent === null ? '—' : `${r.numerator} de ${r.denominator} (${r.percent.toLocaleString('pt-BR')}%)`)

export function ExamsTab({ organization, from, to, values, set, page, setPage }: TabProps & { values: Record<string, string>; set: (key: string, value: string) => void; page: number; setPage: (page: number) => void }) {
  const links = organizationPaths(organization.id)
  const filters = { from, to, category: values.categoria, status: values.situacao }
  const summary = useExamsReport(organization.id, filters)
  const detail = useExamDetail(organization.id, { ...filters, page, per_page: 15 })
  const exportCsv = useExportReport(organization.id, 'exams')

  return (
    <>
      <Row className="g-2 mb-3">
        <Col xs={6} md={3}>
          <Form.Label htmlFor="x-category" className="small mb-1">Categoria</Form.Label>
          <Form.Select id="x-category" value={values.categoria} onChange={(event) => set('categoria', event.target.value)}>
            <option value="">Todas</option>
            {['A', 'B', 'C', 'D', 'E', 'ACC'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Form.Select>
        </Col>
        <Col xs={6} md={3}>
          <Form.Label htmlFor="x-status" className="small mb-1">Situação</Form.Label>
          <Form.Select id="x-status" value={values.situacao} onChange={(event) => set('situacao', event.target.value)}>
            <option value="">Todas</option>
            {Object.entries(EXAM_STATUS).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Form.Select>
        </Col>
      </Row>
      <QueryState query={summary} isEmpty={(d) => d.rows.length === 0} empty="Nenhum exame neste período e filtros.">
        {(data) => (
          <>
            <Row className="g-3 mb-3">
              <Col xs={6} lg={3}><Stat label="Tentativas" value={String(data.totals.total)} /></Col>
              <Col xs={6} lg={3}><Stat label="Taxa de aprovação" value={rate(data.totals.approval_rate)} hint="aprovados ÷ (aprovados + reprovados)" /></Col>
              <Col xs={6} lg={3}><Stat label="Ausentes" value={String(data.totals.absent)} hint="não entram na taxa" /></Col>
              <Col xs={6} lg={3}><Stat label="Resultado pendente" value={String(data.totals.result_pending)} hint="exame passou, sem resultado" /></Col>
            </Row>
            <p className="small text-secondary">{data.basis}</p>
            <DataTable
              rows={data.rows}
              getKey={(r: ExamRow) => `${r.category}-${r.attempt}`}
              columns={[
                { header: 'Categoria e tentativa', primary: true, cell: (r) => `${r.category} · tentativa ${r.attempt}` },
                { header: 'Agendados', cell: (r) => <span className="tabular-nums">{r.scheduled}</span> },
                { header: 'Aprovados', cell: (r) => <span className="tabular-nums">{r.approved}</span> },
                { header: 'Reprovados', cell: (r) => <span className="tabular-nums">{r.failed}</span> },
                { header: 'Ausentes', cell: (r) => <span className="tabular-nums">{r.absent}</span> },
                { header: 'Não concluídos', cell: (r) => <span className="tabular-nums">{r.incomplete}</span> },
                { header: 'Sem resultado', cell: (r) => <span className="tabular-nums">{r.result_pending}</span> },
                { header: 'Aprovação', cell: (r) => <span className="tabular-nums">{rate(r.approval_rate)}</span> },
              ]}
            />
          </>
        )}
      </QueryState>

      <section className="mt-4" aria-labelledby="exams-detail-title">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <h2 id="exams-detail-title" className="h5 mb-0">Exames do período</h2>
          <Button variant="outline-secondary" size="sm" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate(filters)}>
            <i className="bi bi-filetype-csv me-1" aria-hidden="true" />
            Exportar CSV
          </Button>
        </div>
        <QueryState query={detail} isEmpty={(d) => d.data.length === 0} empty="Nenhum exame neste período e filtros.">
          {(data) => (
            <>
              <DataTable
                rows={data.data}
                getKey={(r) => r.id}
                columns={[
                  { header: 'Data e hora', primary: true, cell: (r) => <Link to={links.exam(r.id)} className="tabular-nums">{formatDateTime(r.scheduled_at, organization.timezone)}</Link> },
                  { header: 'Aluno', cell: (r) => r.student ?? '—' },
                  { header: 'Categoria', cell: (r) => `${r.category} · tentativa ${r.attempt}` },
                  { header: 'Situação', cell: (r) => <ExamStatusBadge status={r.status} /> },
                  { header: 'Local', cell: (r) => r.location ?? '—' },
                ]}
              />
              <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={15} onPageChange={setPage} />
            </>
          )}
        </QueryState>
      </section>
    </>
  )
}

function UtilizationTable({ title, rows }: { title: string; rows: ResourceUtilization[] }) {
  return (
    <section className="mb-4">
      <h2 className="h5">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-secondary">Nenhum cadastro ativo.</p>
      ) : (
        <DataTable
          rows={rows}
          getKey={(r) => r.id}
          columns={[
            { header: 'Nome', primary: true, cell: (r) => r.name },
            { header: 'Disponível', cell: (r) => <span className="tabular-nums">{formatMinutes(r.available_minutes)}</span> },
            { header: 'Bloqueado', cell: (r) => <span className="tabular-nums">{formatMinutes(r.blocked_minutes)}</span> },
            { header: 'Utilizado', cell: (r) => <span className="tabular-nums">{formatMinutes(r.used_minutes)}</span> },
            {
              header: 'Utilização',
              cell: (r) => (
                <div style={{ minWidth: 140 }}>
                  <ProgressBar now={Math.min(r.utilization.percent ?? 0, 100)} label={r.utilization.percent === null ? undefined : `${r.utilization.percent.toLocaleString('pt-BR')}%`} aria-label={`Utilização de ${r.name}`} />
                  <span className="small text-secondary tabular-nums">{rate(r.utilization)}</span>
                </div>
              ),
            },
          ]}
        />
      )}
    </section>
  )
}

export function UtilizationTab({ organization, from, to }: TabProps) {
  const query = useUtilizationReport(organization.id, { from, to })
  const rangeTooLong = from !== '' && to !== '' && (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000 > 93

  if (rangeTooLong) return <p className="text-warning-emphasis">Para utilização, escolha um período de até 93 dias.</p>

  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(data) => (
        <>
          <p className="small text-secondary">{data.basis}</p>
          <UtilizationTable title="Instrutores" rows={data.instructors} />
          <UtilizationTable title="Veículos" rows={data.vehicles} />
        </>
      )}
    </QueryState>
  )
}

export function ProcessesTab({ organization }: { organization: Organization }) {
  const links = organizationPaths(organization.id)
  const query = useProcessesReport(organization.id, {})

  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(data) => (
        <>
          <Row className="g-3 mb-4">
            <Col xs={6} lg={3}><Stat label="Documentos vencidos" value={String(data.documents.expired)} /></Col>
            <Col xs={6} lg={3}><Stat label="Documentos a vencer" value={String(data.documents.expiring)} hint={`nos próximos ${data.documents.window_days} dias`} /></Col>
            <Col xs={6} lg={3}><Stat label="Processos sem movimento" value={String(data.stalled.length)} hint={`há mais de ${data.stalled_days} dias`} /></Col>
          </Row>
          <Row className="g-4 mb-4">
            <Col md={4}>
              <h2 className="h6">Por situação</h2>
              <ul className="list-unstyled">
                {data.by_status.map((s) => (
                  <li key={s.key} className="d-flex justify-content-between"><span>{PROCESS_STATUS[s.key as keyof typeof PROCESS_STATUS]?.label ?? s.key}</span><strong className="tabular-nums">{s.count}</strong></li>
                ))}
              </ul>
            </Col>
            <Col md={4}>
              <h2 className="h6">Emissão (processos abertos)</h2>
              <ul className="list-unstyled">
                {data.by_issuance.map((s) => (
                  <li key={s.key} className="d-flex justify-content-between"><span>{ISSUANCE_STATUS[s.key as keyof typeof ISSUANCE_STATUS]?.label ?? s.key}</span><strong className="tabular-nums">{s.count}</strong></li>
                ))}
              </ul>
            </Col>
            <Col md={4}>
              <h2 className="h6">Taxas externas por situação</h2>
              <ul className="list-unstyled">
                {data.fees.map((s) => (
                  <li key={s.key} className="d-flex justify-content-between gap-2">
                    <span>{FEE_STATUS[s.key as keyof typeof FEE_STATUS]?.label ?? s.key}</span>
                    <strong className="tabular-nums">{s.count}{s.amount_cents > 0 && <span className="text-secondary fw-normal"> · {formatCurrency(s.amount_cents / 100)}</span>}</strong>
                  </li>
                ))}
              </ul>
              <p className="small text-secondary">Cada guia é contada uma vez, mesmo compartilhada entre tentativas.</p>
            </Col>
          </Row>
          <h2 className="h5">Sem movimentação</h2>
          {data.stalled.length === 0 ? (
            <p className="text-secondary">Nenhum processo parado.</p>
          ) : (
            <DataTable
              rows={data.stalled}
              getKey={(r) => r.id}
              columns={[
                { header: 'Aluno', primary: true, cell: (r) => <Link to={links.process(r.id)}>{r.student ?? `Processo ${r.id}`}</Link> },
                { header: 'Situação', cell: (r) => <Badge bg={PROCESS_STATUS[r.status as keyof typeof PROCESS_STATUS]?.bg ?? 'secondary'}>{PROCESS_STATUS[r.status as keyof typeof PROCESS_STATUS]?.label ?? r.status}</Badge> },
                { header: 'Sem movimento há', cell: (r) => <span className="tabular-nums">{r.days_without_movement} dias</span> },
              ]}
            />
          )}
        </>
      )}
    </QueryState>
  )
}

export function PartnersTab({ organization, from, to }: TabProps) {
  const query = usePartnersReport(organization.id, { from, to })

  return (
    <QueryState query={query} isEmpty={(d) => d.partners.length === 0} empty="Nenhum parceiro cadastrado.">
      {(data) => (
        <>
          <p className="small text-secondary">{data.basis}</p>
          <DataTable
            rows={data.partners}
            getKey={(r) => r.id}
            columns={[
              { header: 'Parceiro', primary: true, cell: (r) => r.name },
              { header: 'Alunos', cell: (r) => <span className="tabular-nums">{r.students}</span> },
              { header: 'Aulas', cell: (r) => <span className="tabular-nums">{r.lessons} ({r.completed_lessons} realizadas)</span> },
              { header: 'Minutos realizados', cell: (r) => <span className="tabular-nums">{formatMinutes(r.realized_minutes)}</span> },
              { header: 'Exames', cell: (r) => <span className="tabular-nums">{r.exams} ({r.approved_exams} aprovados)</span> },
            ]}
          />
        </>
      )}
    </QueryState>
  )
}
