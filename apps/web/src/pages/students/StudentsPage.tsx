import { useState } from 'react'
import { Form, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { PAGE_SIZE } from '../../config/organization'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useStudents } from '../../hooks/useStudents'
import { formatDate } from '../../utils/formatDate'
import { formatDocument } from '../../utils/formatDocument'
import { canOperate } from '../../utils/permissions'

export default function StudentsPage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const [page, setPage] = usePageParam()
  const [text, setText] = useState('')
  const search = useDebouncedValue(text.trim())

  const query = useStudents(organization.id, { search, page })
  useClampPage(page, query.data?.meta.last_page, setPage)

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="mb-0">Alunos</h1>
        {canOperate(organization.role) && (
          <Link to={links.studentNew} className="btn btn-primary">
            <i className="bi bi-plus-lg me-2" aria-hidden="true" />
            Novo aluno
          </Link>
        )}
      </div>

      <Form.Group controlId="student-search" className="mb-4 form-narrow">
        <Form.Label className="visually-hidden">Buscar aluno por nome</Form.Label>
        <Form.Control
          type="search"
          placeholder="Buscar por nome"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setPage(1, true)
          }}
        />
      </Form.Group>

      <QueryState
        query={query}
        isEmpty={(data) => data.data.length === 0}
        empty={search ? `Nenhum aluno encontrado para "${search}".` : 'Nenhum aluno cadastrado ainda.'}
      >
        {(data) => (
          <>
            <Table responsive hover className="align-middle bg-white">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">Telefone</th>
                  <th scope="col">CPF</th>
                  <th scope="col">Cadastro</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((student) => (
                  <tr key={student.id}>
                    <td>
                      <Link to={links.student(student.id)}>{student.name}</Link>
                    </td>
                    <td className="tabular-nums">{student.phone ?? '—'}</td>
                    <td className="tabular-nums">{student.cpf ? formatDocument(student.cpf) : '—'}</td>
                    <td className="tabular-nums">{formatDate(student.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </QueryState>
    </>
  )
}
