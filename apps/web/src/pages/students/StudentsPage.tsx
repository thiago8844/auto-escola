import { Button, Form } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { ArchivedToggle } from '../../components/ArchivedToggle'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { PAGE_SIZE } from '../../config/organization'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useArchive } from '../../hooks/useArchive'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import { useStudents } from '../../hooks/useStudents'
import { useUrlFilters, useUrlSearch } from '../../hooks/useUrlFilters'
import { formatDate } from '../../utils/formatDate'
import { formatDocument } from '../../utils/formatDocument'
import { canOperate } from '../../utils/permissions'

// Busca, arquivados e página ficam na URL: voltar do detalhe mantém tudo
export default function StudentsPage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const staff = canOperate(organization.role)
  const [page, setPage] = usePageParam()
  const [text, setText, search] = useUrlSearch()
  const { values, set } = useUrlFilters(['arquivados'] as const)
  const archived = staff && values.arquivados === '1'
  const { restore } = useArchive(organization.id, 'students')

  const query = useStudents(organization.id, { search, page, archived })
  useClampPage(page, query.data?.meta.last_page, setPage)

  return (
    <>
      <PageHeader
        title="Alunos"
        actions={
          staff && (
            <Link to={links.studentNew} className="btn btn-primary">
              <i className="bi bi-plus-lg me-2" aria-hidden="true" />
              Novo aluno
            </Link>
          )
        }
      />

      <div className="d-flex flex-wrap align-items-end gap-3 mb-4">
        <Form.Group controlId="student-search" className="flex-grow-1 form-narrow">
          <Form.Label className="visually-hidden">Buscar aluno por nome</Form.Label>
          <Form.Control type="search" placeholder="Buscar por nome" value={text} onChange={(event) => setText(event.target.value)} />
        </Form.Group>
        {staff && <ArchivedToggle id="student-archived" checked={archived} onChange={(checked) => set('arquivados', checked ? '1' : '')} />}
      </div>

      <QueryState
        query={query}
        isEmpty={(data) => data.data.length === 0}
        empty={archived ? 'Nenhum aluno arquivado.' : search ? `Nenhum aluno encontrado para "${search}".` : 'Nenhum aluno cadastrado ainda. Use “Novo aluno” para começar.'}
      >
        {(data) => (
          <>
            <DataTable
              rows={data.data}
              getKey={(student) => student.id}
              columns={[
                { header: 'Nome', primary: true, cell: (student) => <Link to={links.student(student.id)}>{student.name}</Link> },
                { header: 'Telefone', cell: (student) => <span className="tabular-nums">{student.phone ?? '—'}</span> },
                { header: 'CPF', cell: (student) => <span className="tabular-nums">{student.cpf ? formatDocument(student.cpf) : '—'}</span> },
                { header: 'Cadastro', cell: (student) => <span className="tabular-nums">{formatDate(student.created_at, organization.timezone)}</span> },
                ...(archived
                  ? [
                      {
                        header: 'Ações',
                        actions: true,
                        cell: (student: (typeof data.data)[number]) => (
                          <Button size="sm" variant="outline-primary" disabled={restore.isPending} onClick={() => restore.mutate(student.id)}>
                            Restaurar
                          </Button>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </QueryState>
    </>
  )
}
