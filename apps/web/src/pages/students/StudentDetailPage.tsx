import { Alert, Badge, Card, Table } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { QueryState } from '../../components/QueryState'
import { DOCUMENT_STATUS, DOCUMENT_TYPE_LABELS, ENROLLMENT_STATUS, LESSON_STATUS } from '../../config/domain'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useEnrollmentsLessons, useStudentDocuments, useStudentEnrollments } from '../../hooks/useStudentHistory'
import { useStudent } from '../../hooks/useStudents'
import { formatDate } from '../../utils/formatDate'
import { formatDateTime } from '../../utils/formatDateTime'
import { formatDocument } from '../../utils/formatDocument'
import { formatMinutes } from '../../utils/formatMinutes'
import { canOperate } from '../../utils/permissions'
import type { Student } from '../../types/student'

export default function StudentDetailPage() {
  const { studentId = '' } = useParams()
  const organization = useActiveOrganization()
  const query = useStudent(organization.id, studentId)

  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(student) => <StudentDetail student={student} />}
    </QueryState>
  )
}

function StudentDetail({ student }: { student: Student }) {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const operate = canOperate(organization.role)
  const studentId = String(student.id)

  const enrollments = useStudentEnrollments(organization.id, studentId)
  const lessonQueries = useEnrollmentsLessons(organization.id, enrollments.data?.data)
  const documents = useStudentDocuments(organization.id, studentId, operate)

  // Aulas de todas as matrículas, da mais recente para a mais antiga
  const lessons = lessonQueries
    .flatMap((q) => q.data?.data ?? [])
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  const lessonsError = lessonQueries.find((q) => q.error)?.error
  const lessonsLoading = lessonQueries.some((q) => q.isPending)

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h1 className="mb-0 text-break">{student.name}</h1>
        {operate && (
          <Link to={links.studentEdit(student.id)} className="btn btn-outline-primary">
            <i className="bi bi-pencil me-2" aria-hidden="true" />
            Editar
          </Link>
        )}
      </div>

      <Card className="mb-4">
        <Card.Body>
          <dl className="row mb-0">
            <dt className="col-sm-3">Telefone</dt>
            <dd className="col-sm-9">{student.phone ?? '—'}</dd>
            {operate && (
              <>
                <dt className="col-sm-3">CPF</dt>
                <dd className="col-sm-9">{student.cpf ? formatDocument(student.cpf) : '—'}</dd>
                <dt className="col-sm-3">E-mail</dt>
                <dd className="col-sm-9 text-break">{student.email ?? '—'}</dd>
                <dt className="col-sm-3">Nascimento</dt>
                <dd className="col-sm-9 mb-0">{student.birth_date ? formatDate(student.birth_date) : '—'}</dd>
              </>
            )}
          </dl>
        </Card.Body>
      </Card>

      <section className="mb-5" aria-labelledby="enrollments-title">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h2 id="enrollments-title" className="h4 mb-0">
            Matrículas
          </h2>
          {operate && (
            <Link to={links.enrollmentNew(student.id)} className="btn btn-sm btn-primary">
              Nova matrícula
            </Link>
          )}
        </div>
        <QueryState query={enrollments} isEmpty={(d) => d.data.length === 0} empty="Este aluno ainda não tem matrículas.">
          {(data) => (
            <Table responsive hover className="align-middle bg-white">
              <thead>
                <tr>
                  <th scope="col">Categoria</th>
                  <th scope="col">Situação</th>
                  <th scope="col">Serviço contratado</th>
                  <th scope="col">Prática</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((enrollment) => {
                  const status = ENROLLMENT_STATUS[enrollment.status]
                  const release = enrollment.practice_release
                  return (
                    <tr key={enrollment.id}>
                      <td>
                        <Link to={links.enrollment(enrollment.id)}>Categoria {enrollment.category}</Link>
                      </td>
                      <td>
                        <Badge bg={status.bg}>{status.label}</Badge>
                      </td>
                      <td className="tabular-nums">{enrollment.contracted_minutes ? formatMinutes(enrollment.contracted_minutes) : '—'}</td>
                      <td>
                        {release ? (
                          release.released ? (
                            <Badge bg="success">
                              <i className="bi bi-check-circle-fill me-1" aria-hidden="true" />
                              Liberada
                            </Badge>
                          ) : (
                            <Badge bg="warning" text="dark">
                              <i className="bi bi-lock-fill me-1" aria-hidden="true" />
                              Bloqueada
                            </Badge>
                          )
                        ) : (
                          <span className="text-secondary">Sem processo</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </QueryState>
      </section>

      <section className="mb-5" aria-labelledby="lessons-title">
        <h2 id="lessons-title" className="h4 mb-3">
          Aulas
        </h2>
        {lessonsError ? (
          <Alert variant="danger" role="alert">
            {lessonsError.message}
          </Alert>
        ) : lessonsLoading ? (
          <p className="text-secondary">Carregando aulas…</p>
        ) : lessons.length === 0 ? (
          <Alert variant="info">Nenhuma aula agendada para este aluno.</Alert>
        ) : (
          <Table responsive hover className="align-middle bg-white">
            <thead>
              <tr>
                <th scope="col">Data e hora</th>
                <th scope="col">Instrutor</th>
                <th scope="col">Situação</th>
              </tr>
            </thead>
            <tbody>
              {lessons.slice(0, 10).map((lesson) => {
                const status = LESSON_STATUS[lesson.status]
                return (
                  <tr key={lesson.id}>
                    <td className="tabular-nums">{formatDateTime(lesson.starts_at, organization.timezone)}</td>
                    <td>{lesson.instructor?.full_name ?? '—'}</td>
                    <td>
                      <Badge bg={status.bg} text={status.bg === 'warning' ? 'dark' : undefined}>
                        <i className={`bi ${status.icon} me-1`} aria-hidden="true" />
                        {status.label}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
        {lessons.length > 10 && <p className="small text-secondary">Mostrando as 10 aulas mais recentes.</p>}
      </section>

      {operate && (
        <section aria-labelledby="documents-title">
          <h2 id="documents-title" className="h4 mb-3">
            Documentos
          </h2>
          <QueryState query={documents} isEmpty={(d) => d.data.length === 0} empty="Nenhum documento anexado a este aluno.">
            {(data) => (
              <Table responsive hover className="align-middle bg-white">
                <thead>
                  <tr>
                    <th scope="col">Documento</th>
                    <th scope="col">Arquivo</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Validade</th>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((doc) => {
                    const status = DOCUMENT_STATUS[doc.status]
                    return (
                      <tr key={doc.id}>
                        <td>
                          {DOCUMENT_TYPE_LABELS[doc.type]} <span className="text-secondary small">v{doc.version}</span>
                        </td>
                        <td className="text-break">{doc.original_name}</td>
                        <td>
                          <Badge bg={status.bg}>{status.label}</Badge>
                        </td>
                        <td className="tabular-nums">{doc.expires_at ? formatDate(doc.expires_at) : 'Indeterminada'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )}
          </QueryState>
        </section>
      )}
    </>
  )
}
