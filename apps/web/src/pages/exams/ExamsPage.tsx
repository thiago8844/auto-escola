import { useState } from 'react'
import { Alert, Button, Col, Form, Row } from 'react-bootstrap'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { ExamStatusBadge } from '../../components/StatusBadges'
import { EXAM_STATUS } from '../../config/domain'
import { PAGE_SIZE } from '../../config/organization'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useExams } from '../../hooks/useExams'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import { VEHICLE_CATEGORIES } from '../../config/domain'
import { formatDateTime } from '../../utils/formatDateTime'
import { canOperate } from '../../utils/permissions'
import { ExamFormModal } from './ExamFormModal'

// Lista de exames práticos. Os filtros ficam na URL: voltar do detalhe mantém busca, período e página.
export default function ExamsPage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const staff = canOperate(organization.role)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = usePageParam()
  const [creating, setCreating] = useState(false)

  const filters = {
    from: searchParams.get('de') ?? '',
    to: searchParams.get('ate') ?? '',
    category: searchParams.get('categoria') ?? '',
    status: searchParams.get('situacao') ?? '',
  }
  const [text, setText] = useState(searchParams.get('busca') ?? '')
  const search = useDebouncedValue(text.trim())

  const setFilter = (key: string, value: string) => {
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        if (value) next.set(key, value)
        else next.delete(key)
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }
  const rangeInvalid = filters.from !== '' && filters.to !== '' && filters.to < filters.from

  const query = useExams(organization.id, { page, perPage: PAGE_SIZE, ...filters, q: search, order: 'desc' }, !rangeInvalid)
  useClampPage(page, query.data?.meta.last_page, setPage)
  const hasFilters = Object.values(filters).some(Boolean) || search !== ''

  return (
    <>
      <PageHeader
        title="Exames práticos"
        subtitle={staff ? 'Agenda, tentativas e resultados por categoria.' : 'Exames em que você é o instrutor responsável.'}
        actions={
          staff && (
            <Button onClick={() => setCreating(true)}>
              <i className="bi bi-plus-lg me-2" aria-hidden="true" />
              Agendar exame
            </Button>
          )
        }
      />

      <form className="mb-4" onSubmit={(event) => event.preventDefault()} aria-label="Filtros de exames">
        <Row className="g-2">
          <Col md={4}>
            <Form.Label htmlFor="exam-search" className="small mb-1">Buscar aluno</Form.Label>
            <Form.Control id="exam-search" type="search" placeholder="Nome do aluno" value={text} onChange={(event) => setText(event.target.value)} />
          </Col>
          <Col xs={6} md={2}>
            <Form.Label htmlFor="exam-from" className="small mb-1">De</Form.Label>
            <Form.Control id="exam-from" type="date" value={filters.from} onChange={(event) => setFilter('de', event.target.value)} />
          </Col>
          <Col xs={6} md={2}>
            <Form.Label htmlFor="exam-to" className="small mb-1">Até</Form.Label>
            <Form.Control id="exam-to" type="date" value={filters.to} isInvalid={rangeInvalid} onChange={(event) => setFilter('ate', event.target.value)} />
          </Col>
          <Col xs={6} md={2}>
            <Form.Label htmlFor="exam-category" className="small mb-1">Categoria</Form.Label>
            <Form.Select id="exam-category" value={filters.category} onChange={(event) => setFilter('categoria', event.target.value)}>
              <option value="">Todas</option>
              {VEHICLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Form.Select>
          </Col>
          <Col xs={6} md={2}>
            <Form.Label htmlFor="exam-status" className="small mb-1">Situação</Form.Label>
            <Form.Select id="exam-status" value={filters.status} onChange={(event) => setFilter('situacao', event.target.value)}>
              <option value="">Todas</option>
              {Object.entries(EXAM_STATUS).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Form.Select>
          </Col>
        </Row>
        {rangeInvalid && <p className="small text-danger mt-2 mb-0">A data final não pode ser anterior à inicial.</p>}
        {hasFilters && (
          <Button
            variant="link"
            size="sm"
            className="px-0 mt-2"
            onClick={() => {
              setText('')
              setSearchParams({}, { replace: true })
            }}
          >
            Limpar filtros
          </Button>
        )}
      </form>

      {rangeInvalid ? null : (
        <QueryState
          query={query}
          isEmpty={(data) => data.data.length === 0}
          empty={hasFilters ? 'Nenhum exame encontrado com estes filtros.' : staff ? 'Nenhum exame agendado ainda. Use “Agendar exame” para criar a primeira tentativa.' : 'Você ainda não é responsável por nenhum exame.'}
        >
          {(data) => (
            <>
              <DataTable
                rows={data.data}
                getKey={(exam) => exam.id}
                columns={[
                  {
                    header: 'Data e hora',
                    primary: true,
                    cell: (exam) => (
                      <Link to={links.exam(exam.id)} className="tabular-nums">
                        {formatDateTime(exam.scheduled_at, organization.timezone)}
                      </Link>
                    ),
                  },
                  { header: 'Aluno', cell: (exam) => exam.student?.name ?? '—' },
                  { header: 'Categoria', cell: (exam) => `${exam.category} · tentativa ${exam.attempt_number}` },
                  { header: 'Local', cell: (exam) => exam.location ?? '—' },
                  { header: 'Situação', cell: (exam) => <ExamStatusBadge status={exam.status} /> },
                  ...(staff
                    ? [
                        {
                          header: 'Pendências',
                          cell: (exam: (typeof data.data)[number]) =>
                            exam.pending && exam.pending.length > 0 ? (
                              <span className="text-warning-emphasis">
                                <i className="bi bi-exclamation-triangle-fill me-1" aria-hidden="true" />
                                {exam.pending.length}
                              </span>
                            ) : (
                              '—'
                            ),
                        },
                      ]
                    : [{ header: 'Veículo', cell: (exam: (typeof data.data)[number]) => exam.vehicle?.plate ?? '—' }]),
                ]}
              />
              <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </QueryState>
      )}

      {!staff && (
        <Alert variant="secondary" className="small mt-3">
          Por privacidade, instrutores veem apenas o resumo operacional dos próprios exames.
        </Alert>
      )}

      {creating && (
        <ExamFormModal
          organizationId={organization.id}
          timezone={organization.timezone}
          onClose={() => setCreating(false)}
          onCreated={(examId) => navigate(links.exam(examId))}
        />
      )}
    </>
  )
}
