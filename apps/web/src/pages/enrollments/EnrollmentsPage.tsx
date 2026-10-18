import { Button, Col, Form, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { BalanceBadge } from '../../components/BalanceBar'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { EnrollmentStatusBadge, ReleaseBadge } from '../../components/StatusBadges'
import { ENROLLMENT_STATUS, LICENSE_CATEGORIES } from '../../config/domain'
import { PAGE_SIZE } from '../../config/organization'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useEnrollments } from '../../hooks/useEnrollments'
import { usePartners } from '../../hooks/usePartners'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import { useUrlFilters, useUrlSearch } from '../../hooks/useUrlFilters'
import { formatMinutes } from '../../utils/formatMinutes'
import { canOperate } from '../../utils/permissions'

// Filtros e página ficam na URL: voltar do detalhe mantém a lista como estava
export default function EnrollmentsPage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const staff = canOperate(organization.role)
  const [page, setPage] = usePageParam()
  const [text, setText, search] = useUrlSearch()
  const { values, set, clear, active } = useUrlFilters(['situacao', 'categoria', 'parceiro'] as const)
  const partners = usePartners(organization.id, { page: 1, all: true }, staff && organization.type === 'independent')

  const query = useEnrollments(organization.id, page, { status: values.situacao, category: values.categoria, partnerId: values.parceiro, search })
  useClampPage(page, query.data?.meta.last_page, setPage)
  const filtered = active || search !== ''

  return (
    <>
      <PageHeader title="Matrículas" subtitle={staff ? 'Para criar uma matrícula, abra o aluno e escolha “Nova matrícula”.' : 'Aqui aparecem seus alunos encaminhados e matrículas com aulas suas neste espaço.'} />

      <form className="mb-4" onSubmit={(event) => event.preventDefault()} aria-label="Filtros de matrículas">
        <Row className="g-2">
          <Col md={4}>
            <Form.Label htmlFor="enrollment-search" className="small mb-1">Buscar aluno</Form.Label>
            <Form.Control id="enrollment-search" type="search" placeholder="Nome do aluno" value={text} onChange={(event) => setText(event.target.value)} />
          </Col>
          <Col xs={6} md={2}>
            <Form.Label htmlFor="enrollment-status" className="small mb-1">Situação</Form.Label>
            <Form.Select id="enrollment-status" value={values.situacao} onChange={(event) => set('situacao', event.target.value)}>
              <option value="">Todas</option>
              {Object.entries(ENROLLMENT_STATUS).map(([value, { label }]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Form.Select>
          </Col>
          <Col xs={6} md={2}>
            <Form.Label htmlFor="enrollment-category" className="small mb-1">Categoria</Form.Label>
            <Form.Select id="enrollment-category" value={values.categoria} onChange={(event) => set('categoria', event.target.value)}>
              <option value="">Todas</option>
              {LICENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Form.Select>
          </Col>
          {staff && organization.type === 'independent' && (
            <Col xs={12} md={4}>
              <Form.Label htmlFor="enrollment-partner" className="small mb-1">Auto escola parceira</Form.Label>
              <Form.Select id="enrollment-partner" value={values.parceiro} onChange={(event) => set('parceiro', event.target.value)}>
                <option value="">Todas</option>
                {partners.data?.data.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Form.Select>
            </Col>
          )}
        </Row>
        {filtered && (
          <Button variant="link" size="sm" className="px-0 mt-2" onClick={() => { setText(''); clear() }}>
            Limpar filtros
          </Button>
        )}
      </form>

      <QueryState query={query} isEmpty={(data) => data.data.length === 0} empty={filtered ? 'Nenhuma matrícula encontrada com estes filtros.' : staff ? 'Nenhuma matrícula cadastrada ainda. Abra um aluno e escolha “Nova matrícula”.' : 'Nenhuma matrícula atribuída ainda. A secretaria pode encaminhar um aluno para você.'}>
        {(data) => (
          <>
            <DataTable
              rows={data.data}
              getKey={(enrollment) => enrollment.id}
              columns={[
                {
                  header: 'Aluno',
                  primary: true,
                  cell: (enrollment) => <Link to={links.enrollment(enrollment.id)}>{enrollment.student?.name ?? `Matrícula ${enrollment.id}`}</Link>,
                },
                { header: 'Categoria', cell: (enrollment) => enrollment.category },
                { header: 'Situação', cell: (enrollment) => <EnrollmentStatusBadge status={enrollment.status} /> },
                { header: 'Responsável', cell: (enrollment) => enrollment.assignment?.instructor_name ?? 'Ainda não encaminhado' },
                {
                  header: 'Serviço contratado',
                  cell: (enrollment) => <span className="tabular-nums">{enrollment.contracted_minutes ? formatMinutes(enrollment.contracted_minutes) : '—'}</span>,
                },
                ...(staff ? [{
                  header: 'Saldo de aulas',
                  cell: (enrollment: import('../../types/enrollment').Enrollment) => (enrollment.balance ? <BalanceBadge available={enrollment.balance.available} hasPackage={enrollment.balance.has_package} /> : '—'),
                }] : []),
                { header: 'Prática', cell: (enrollment) => <ReleaseBadge release={enrollment.practice_release} /> },
              ]}
            />
            <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </QueryState>
    </>
  )
}
