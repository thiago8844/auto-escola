import { Button, Col, Form, Row } from 'react-bootstrap'
import { DataTable } from '../../components/DataTable'
import { RecordPreview } from '../../components/RecordPreview'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { ProcessStatusBadge, ReleaseBadge } from '../../components/StatusBadges'
import { LICENSE_CATEGORIES, PROCESS_STATUS, PROCESS_TYPE_LABELS } from '../../config/domain'
import { PAGE_SIZE } from '../../config/organization'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import { useProcesses } from '../../hooks/useProcesses'
import { useUrlFilters, useUrlSearch } from '../../hooks/useUrlFilters'

// Filtros e página ficam na URL: voltar do detalhe mantém a lista como estava
export default function ProcessesPage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const [page, setPage] = usePageParam()
  const [text, setText, search] = useUrlSearch()
  const { values, set, clear, active } = useUrlFilters(['situacao', 'tipo', 'categoria'] as const)
  const query = useProcesses(organization.id, { page, status: values.situacao, type: values.tipo, category: values.categoria, search })
  useClampPage(page, query.data?.meta.last_page, setPage)
  const filtered = active || search !== ''

  return (
    <>
      <PageHeader title="Processos de habilitação" subtitle="Acompanhamento local de cada atendimento. Para criar um, abra o aluno." />

      <form className="mb-4" onSubmit={(event) => event.preventDefault()} aria-label="Filtros de processos">
        <Row className="g-2">
          <Col md={4}>
            <Form.Label htmlFor="process-search" className="small mb-1">Buscar aluno</Form.Label>
            <Form.Control id="process-search" type="search" placeholder="Nome do aluno" value={text} onChange={(event) => setText(event.target.value)} />
          </Col>
          <Col xs={6} md={3}>
            <Form.Label htmlFor="process-status" className="small mb-1">Situação</Form.Label>
            <Form.Select id="process-status" value={values.situacao} onChange={(event) => set('situacao', event.target.value)}>
              <option value="">Todas</option>
              {Object.entries(PROCESS_STATUS).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Form.Select>
          </Col>
          <Col xs={6} md={3}>
            <Form.Label htmlFor="process-type" className="small mb-1">Tipo</Form.Label>
            <Form.Select id="process-type" value={values.tipo} onChange={(event) => set('tipo', event.target.value)}>
              <option value="">Todos</option>
              {Object.entries(PROCESS_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Form.Select>
          </Col>
          <Col xs={6} md={2}>
            <Form.Label htmlFor="process-category" className="small mb-1">Categoria</Form.Label>
            <Form.Select id="process-category" value={values.categoria} onChange={(event) => set('categoria', event.target.value)}>
              <option value="">Todas</option>
              {LICENSE_CATEGORIES.filter((c) => c.length === 1 || c === 'ACC').map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Form.Select>
          </Col>
        </Row>
        {filtered && (
          <Button variant="link" size="sm" className="px-0 mt-2" onClick={() => { setText(''); clear() }}>
            Limpar filtros
          </Button>
        )}
      </form>

      <QueryState query={query} isEmpty={(data) => data.data.length === 0} empty={filtered ? 'Nenhum processo encontrado com estes filtros.' : 'Nenhum processo cadastrado ainda. Abra um aluno e escolha “Novo processo”.'}>
        {(data) => (
          <>
            <DataTable
              rows={data.data}
              getKey={(process) => process.id}
              columns={[
                {
                  header: 'Aluno',
                  primary: true,
                  cell: (process) => process.student?.name ?? `Processo ${process.id}`,
                },
                { header: 'Tipo', cell: (process) => PROCESS_TYPE_LABELS[process.type] },
                { header: 'Categorias', cell: (process) => process.target_categories.join(', ') },
                { header: 'Situação', cell: (process) => <ProcessStatusBadge status={process.status} /> },
                { header: 'Prática', cell: (process) => <ReleaseBadge release={process.practice_release} /> },
              ]}
              preview={{
                label: (process) => process.student?.name ?? `processo ${process.id}`,
                render: (process) => (
                  <RecordPreview
                    to={links.process(process.id)}
                    action="Abrir processo"
                    fields={[
                      { label: 'UF / município', value: [process.uf, process.municipality].filter(Boolean).join(' · ') },
                      { label: 'RENACH', value: process.renach },
                      { label: 'Protocolo', value: process.protocol },
                      { label: 'Categorias atuais', value: process.current_categories.join(', ') },
                      { label: 'Observações', value: process.notes },
                    ]}
                  />
                ),
              }}
            />
            <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </QueryState>
    </>
  )
}
