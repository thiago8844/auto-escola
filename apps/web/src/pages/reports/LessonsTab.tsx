import { Button, Col, Form, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { DataTable } from '../../components/DataTable'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { LessonStatusBadge } from '../../components/StatusBadges'
import { LESSON_STATUS } from '../../config/domain'
import { organizationPaths } from '../../config/paths'
import { useInstructors } from '../../hooks/useInstructors'
import { usePartners } from '../../hooks/usePartners'
import { useExportReport, useLessonDetail, useLessonsReport } from '../../hooks/useReports'
import { useVehicles } from '../../hooks/useVehicles'
import type { Organization } from '../../types/organization'
import type { LessonGroupBy } from '../../types/reports'
import { formatDateTime } from '../../utils/formatDateTime'
import { formatMinutes } from '../../utils/formatMinutes'
import { Stat } from './ReportFilters'

const GROUP_LABELS: Record<LessonGroupBy, string> = { status: 'Situação', instructor: 'Instrutor', vehicle: 'Veículo', category: 'Categoria', partner: 'Parceiro', day: 'Dia' }
// Qual filtro cada agrupamento aplica quando a pessoa clica em “Ver aulas”
const DRILL_PARAM: Partial<Record<LessonGroupBy, string>> = { status: 'situacao', instructor: 'instrutor', vehicle: 'veiculo', category: 'categoria', partner: 'parceiro' }

type Props = {
  organization: Organization
  values: Record<string, string>
  set: (key: string, value: string) => void
  setMany: (patch: Record<string, string>) => void
  page: number
  setPage: (page: number) => void
}

export function LessonsTab({ organization, values, set, setMany, page, setPage }: Props) {
  const links = organizationPaths(organization.id)
  const independent = organization.type === 'independent'
  const groupBy = (values.agrupar || 'status') as LessonGroupBy
  const instructors = useInstructors(organization.id, { page: 1, all: true })
  const vehicles = useVehicles(organization.id, { page: 1, all: true })
  const partners = usePartners(organization.id, { page: 1, all: true }, independent)

  const filters = {
    from: values.de,
    to: values.ate,
    instructor_id: values.instrutor,
    vehicle_id: values.veiculo,
    category: values.categoria,
    status: values.situacao,
    partner_id: values.parceiro,
    include_cancelled: values.cancelamentos === '0' ? '0' : undefined,
  }
  const summary = useLessonsReport(organization.id, { ...filters, group_by: groupBy })
  const detail = useLessonDetail(organization.id, { ...filters, page, per_page: 15 })
  const exportCsv = useExportReport(organization.id, 'lessons')
  const rangeInvalid = values.de !== '' && values.ate !== '' && values.ate < values.de

  const drill = (key: string | number | null) => {
    const param = DRILL_PARAM[groupBy]
    if (param && key !== null) set(param, String(key))
    else if (groupBy === 'day' && key) setMany({ de: String(key), ate: String(key) })
    document.getElementById('lessons-detail')?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <Row className="g-2 mb-3">
        <Col xs={6} md={3}>
          <Form.Label htmlFor="f-instructor" className="small mb-1">Instrutor</Form.Label>
          <Form.Select id="f-instructor" value={values.instrutor} onChange={(event) => set('instrutor', event.target.value)}>
            <option value="">Todos</option>
            {instructors.data?.data.map((i) => (
              <option key={i.id} value={i.id}>{i.full_name}</option>
            ))}
          </Form.Select>
        </Col>
        <Col xs={6} md={3}>
          <Form.Label htmlFor="f-vehicle" className="small mb-1">Veículo</Form.Label>
          <Form.Select id="f-vehicle" value={values.veiculo} onChange={(event) => set('veiculo', event.target.value)}>
            <option value="">Todos</option>
            {vehicles.data?.data.map((v) => (
              <option key={v.id} value={v.id}>{v.plate}</option>
            ))}
          </Form.Select>
        </Col>
        <Col xs={6} md={2}>
          <Form.Label htmlFor="f-category" className="small mb-1">Categoria</Form.Label>
          <Form.Select id="f-category" value={values.categoria} onChange={(event) => set('categoria', event.target.value)}>
            <option value="">Todas</option>
            {['A', 'B', 'C', 'D', 'E', 'ACC'].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Form.Select>
        </Col>
        <Col xs={6} md={2}>
          <Form.Label htmlFor="f-status" className="small mb-1">Situação</Form.Label>
          <Form.Select id="f-status" value={values.situacao} onChange={(event) => set('situacao', event.target.value)}>
            <option value="">Todas</option>
            {Object.entries(LESSON_STATUS).map(([value, { label }]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Form.Select>
        </Col>
        {independent && (
          <Col xs={6} md={2}>
            <Form.Label htmlFor="f-partner" className="small mb-1">Parceiro</Form.Label>
            <Form.Select id="f-partner" value={values.parceiro} onChange={(event) => set('parceiro', event.target.value)}>
              <option value="">Todos</option>
              {partners.data?.data.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Form.Select>
          </Col>
        )}
        <Col xs={12} md="auto" className="d-flex align-items-end">
          <Form.Check type="switch" id="f-cancelled" label="Incluir cancelamentos" checked={values.cancelamentos !== '0'} onChange={(event) => set('cancelamentos', event.target.checked ? '' : '0')} />
        </Col>
      </Row>

      {rangeInvalid ? null : (
        <>
          <QueryState query={summary} isEmpty={() => false} empty={null}>
            {(data) => (
              <>
                <Row className="g-3 mb-3">
                  <Col xs={6} lg={3}><Stat label="Aulas" value={String(data.totals.count)} /></Col>
                  <Col xs={6} lg={3}><Stat label="Duração agendada" value={formatMinutes(data.totals.scheduled_minutes)} /></Col>
                  <Col xs={6} lg={3}><Stat label="Duração real (realizadas)" value={formatMinutes(data.totals.actual_minutes)} /></Col>
                  <Col xs={6} lg={3}><Stat label="Com registro oficial confirmado" value={formatMinutes(data.totals.confirmed_minutes)} /></Col>
                </Row>
                <div className="d-flex flex-wrap align-items-end gap-3 mb-2">
                  <Form.Group controlId="group-by">
                    <Form.Label className="small mb-1">Agrupar por</Form.Label>
                    <Form.Select size="sm" value={groupBy} onChange={(event) => set('agrupar', event.target.value === 'status' ? '' : event.target.value)}>
                      {Object.entries(GROUP_LABELS)
                        .filter(([key]) => independent || key !== 'partner')
                        .map(([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ))}
                    </Form.Select>
                  </Form.Group>
                  <p className="small text-secondary mb-1">{data.basis}</p>
                </div>
                {data.groups.length === 0 ? (
                  <p className="text-secondary">Nenhuma aula neste período e filtros.</p>
                ) : (
                  <DataTable
                    rows={data.groups}
                    getKey={(g) => String(g.key)}
                    columns={[
                      { header: GROUP_LABELS[groupBy], primary: true, cell: (g) => (groupBy === 'day' && g.key ? formatDay(String(g.key)) : g.label) },
                      { header: 'Aulas', cell: (g) => <span className="tabular-nums">{g.count}</span> },
                      { header: 'Agendado', cell: (g) => <span className="tabular-nums">{formatMinutes(g.scheduled_minutes)}</span> },
                      { header: 'Real', cell: (g) => <span className="tabular-nums">{formatMinutes(g.actual_minutes)}</span> },
                      { header: 'Oficial confirmado', cell: (g) => <span className="tabular-nums">{formatMinutes(g.confirmed_minutes)}</span> },
                      {
                        header: 'Ver',
                        actions: true,
                        cell: (g) => (
                          <Button size="sm" variant="outline-primary" onClick={() => drill(g.key)}>
                            Ver aulas
                          </Button>
                        ),
                      },
                    ]}
                  />
                )}
              </>
            )}
          </QueryState>

          <section id="lessons-detail" aria-labelledby="lessons-detail-title" className="mt-4">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
              <h2 id="lessons-detail-title" className="h5 mb-0">Aulas do período</h2>
              <Button variant="outline-secondary" size="sm" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate(filters)}>
                <i className="bi bi-filetype-csv me-1" aria-hidden="true" />
                Exportar CSV
              </Button>
            </div>
            <QueryState query={detail} isEmpty={(d) => d.data.length === 0} empty="Nenhuma aula neste período e filtros.">
              {(data) => (
                <>
                  <p className="small text-secondary">
                    {data.meta.total} {data.meta.total === 1 ? 'aula' : 'aulas'} · {formatMinutes(data.totals.scheduled_minutes)} agendados — o mesmo conjunto dos totais acima e da exportação.
                  </p>
                  <DataTable
                    rows={data.data}
                    getKey={(r) => r.id}
                    columns={[
                      { header: 'Data e hora', primary: true, cell: (r) => <Link to={links.lesson(r.id)} className="tabular-nums">{formatDateTime(r.starts_at, organization.timezone)}</Link> },
                      { header: 'Aluno', cell: (r) => r.student ?? '—' },
                      { header: 'Instrutor', cell: (r) => r.instructor ?? '—' },
                      { header: 'Veículo', cell: (r) => r.vehicle ?? '—' },
                      { header: 'Categoria', cell: (r) => r.category ?? '—' },
                      { header: 'Situação', cell: (r) => <LessonStatusBadge status={r.status} /> },
                      { header: 'Agendado / real', cell: (r) => <span className="tabular-nums">{r.scheduled_minutes} / {r.actual_minutes ?? '—'} min</span> },
                    ]}
                  />
                  <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={15} onPageChange={setPage} />
                </>
              )}
            </QueryState>
          </section>
        </>
      )}
    </>
  )
}

function formatDay(date: string) {
  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

