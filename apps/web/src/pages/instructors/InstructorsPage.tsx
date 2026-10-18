import { useState } from 'react'
import { Form } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { LinkStatusBadge } from '../../components/StatusBadges'
import { PAGE_SIZE } from '../../config/organization'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useInstructors } from '../../hooks/useInstructors'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'

type ActiveFilter = '' | 'active' | 'inactive'

export default function InstructorsPage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const [page, setPage] = usePageParam()
  const [filter, setFilter] = useState<ActiveFilter>('')

  const query = useInstructors(organization.id, { page, active: filter === '' ? undefined : filter === 'active' })
  useClampPage(page, query.data?.meta.last_page, setPage)

  return (
    <>
      <PageHeader
        title="Instrutores"
        actions={
          <Link to={links.instructorNew} className="btn btn-primary">
            <i className="bi bi-plus-lg me-2" aria-hidden="true" />
            Novo instrutor
          </Link>
        }
      />

      <Form.Group controlId="instructor-filter" className="mb-4 form-narrow">
        <Form.Label className="visually-hidden">Vínculo</Form.Label>
        <Form.Select
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value as ActiveFilter)
            setPage(1, true)
          }}
        >
          <option value="">Todos os vínculos</option>
          <option value="active">Somente ativos</option>
          <option value="inactive">Somente desativados</option>
        </Form.Select>
      </Form.Group>

      <QueryState query={query} isEmpty={(data) => data.data.length === 0} empty={filter ? 'Nenhum instrutor com esse filtro.' : 'Nenhum instrutor vinculado a este espaço ainda.'}>
        {(data) => (
          <>
            <DataTable
              rows={data.data}
              getKey={(instructor) => instructor.id}
              columns={[
                { header: 'Nome', primary: true, cell: (instructor) => instructor.full_name },
                { header: 'Credencial', cell: (instructor) => instructor.credential_number ?? '—' },
                { header: 'Categorias', cell: (instructor) => (instructor.categories.length > 0 ? instructor.categories.join(', ') : '—') },
                { header: 'Conta', cell: (instructor) => (instructor.has_account ? 'Com conta própria' : 'Sem conta') },
                { header: 'Vínculo', cell: (instructor) => <LinkStatusBadge active={instructor.active !== false} /> },
              ]}
              open={{ to: (instructor) => links.instructor(instructor.id), label: (instructor) => instructor.full_name }}
            />
            <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </QueryState>
    </>
  )
}
