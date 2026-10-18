import { RecordLink } from '../../components/RecordLink'
import { RecordSection } from '../../components/RecordSection'
import { useState } from 'react'
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DataTable } from '../../components/DataTable'
import { ArchiveCard } from '../../components/ArchiveCard'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { BalanceBadge } from '../../components/BalanceBar'
import { DocumentStatusBadge, EnrollmentStatusBadge, LessonStatusBadge, ReleaseBadge } from '../../components/StatusBadges'
import { DOCUMENT_STATUS, DOCUMENT_TYPE_LABELS } from '../../config/domain'
import type { DocumentStatus, StudentDocument } from '../../types/document'
import { Timeline } from '../../components/Timeline'
import { ExamsSummary } from '../exams/ExamsSummary'
import { DocumentVersionsModal } from './DocumentVersionsModal'
import { UploadDocumentModal } from './UploadDocumentModal'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useArchive } from '../../hooks/useArchive'
import { useDocumentFile, useUpdateDocumentStatus } from '../../hooks/useDocuments'
import { useEnrollmentsLessons, useStudentDocuments, useStudentEnrollments } from '../../hooks/useStudentHistory'
import { useStudent } from '../../hooks/useStudents'
import type { Enrollment } from '../../types/enrollment'
import type { Student } from '../../types/student'
import { formatDate } from '../../utils/formatDate'
import { formatDateTime } from '../../utils/formatDateTime'
import { formatDocument } from '../../utils/formatDocument'
import { formatMinutes } from '../../utils/formatMinutes'
import { canOperate } from '../../utils/permissions'

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

const LESSONS_STEP = 10

function StudentDetail({ student }: { student: Student }) {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const operate = canOperate(organization.role)
  const studentId = String(student.id)
  const navigate = useNavigate()
  const { archive } = useArchive(organization.id, 'students')

  const enrollments = useStudentEnrollments(organization.id, studentId)
  const lessonQueries = useEnrollmentsLessons(organization.id, enrollments.data?.data)
  const documents = useStudentDocuments(organization.id, studentId, operate)
  const documentFile = useDocumentFile(organization.id)
  const updateDocumentStatus = useUpdateDocumentStatus(organization.id)
  const [uploading, setUploading] = useState(false)
  const [replacing, setReplacing] = useState<StudentDocument | null>(null)
  const [versionsOf, setVersionsOf] = useState<StudentDocument | null>(null)
  const [lessonsShown, setLessonsShown] = useState(LESSONS_STEP)

  // Aulas de todas as matrículas, da mais recente para a mais antiga
  const lessons = lessonQueries.flatMap((q) => q.data?.data ?? []).sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  const lessonsError = lessonQueries.find((q) => q.error)?.error
  const lessonsLoading = lessonQueries.some((q) => q.isPending)

  const nextLesson = [...lessons].filter((lesson) => lesson.status === 'scheduled' && lesson.ends_at >= new Date().toISOString()).sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0]
  const completedLessons = lessons.filter((lesson) => lesson.status === 'completed').length
  const openEnrollments = enrollments.data?.data.filter((e) => e.status !== 'closed' && e.status !== 'terminated') ?? []
  const pendingDocuments = documents.data?.data.filter((d) => d.status === 'attached' || d.status === 'rejected').length ?? 0
  const withBalance = openEnrollments.filter((e) => e.balance?.has_package)

  return (
    <>
      <PageHeader
        title={student.name}
        actions={
          operate && (
            <>
              <Link to={links.studentSummary(student.id)} className="btn btn-outline-secondary">
                <i className="bi bi-file-earmark-text me-2" aria-hidden="true" />
                Resumo
              </Link>
              <Link to={links.studentEdit(student.id)} className="btn btn-outline-primary">
                <i className="bi bi-pencil me-2" aria-hidden="true" />
                Editar
              </Link>
            </>
          )
        }
      />

      <Row className="g-3 mb-4">
        <Col md={5}><Card className="h-100 border-primary-subtle"><Card.Body><div className="small text-secondary mb-2">Próxima aula</div>
          {lessonsLoading ? <span>Carregando…</span> : nextLesson ? <><Link className="fw-semibold" to={links.lesson(nextLesson.id)}>{formatDateTime(nextLesson.starts_at, organization.timezone)}</Link><div className="small text-secondary mt-1">{nextLesson.instructor?.full_name}</div></> : <><div className="mb-2">Nenhuma aula agendada</div>{operate && <Link className="btn btn-sm btn-primary" to={openEnrollments.length === 1 ? links.scheduleNew(`?matricula=${openEnrollments[0].id}`) : openEnrollments.length > 1 ? '#enrollments-title' : links.enrollmentNew(student.id)}>{openEnrollments.length ? 'Agendar aula' : 'Criar matrícula'}</Link>}</>}
        </Card.Body></Card></Col>
        <Col md={3}><Card className="h-100"><Card.Body><div className="small text-secondary mb-2">Aulas realizadas</div><div className="h3 mb-0">{lessonsLoading ? '…' : completedLessons}</div><div className="small text-secondary">Histórico do aluno neste espaço</div></Card.Body></Card></Col>
        {operate && <Col md={4}><Card className="h-100"><Card.Body><div className="small text-secondary mb-2">Saldo disponível</div><div className="h4 mb-1">{enrollments.isPending ? '…' : withBalance.length ? formatMinutes(withBalance.reduce((n, e) => n + (e.balance?.available ?? 0), 0)) : 'Sem pacote ativo'}</div><div className="small text-secondary">{pendingDocuments ? `${pendingDocuments} documento(s) para conferir` : 'Documentos e liberação nos detalhes abaixo'}</div></Card.Body></Card></Col>}
      </Row>

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
        <div id="enrollments-title">
          <PageHeader
            as="h2"
            title="Matrículas"
            actions={
              operate && (
                <Link to={links.enrollmentNew(student.id)} className="btn btn-sm btn-primary">
                  Nova matrícula
                </Link>
              )
            }
          />
        </div>
        <QueryState query={enrollments} isEmpty={(d) => d.data.length === 0} empty="Este aluno ainda não tem matrículas.">
          {(data) => (
            <DataTable
              rows={data.data}
              getKey={(enrollment) => enrollment.id}
              columns={[
                {
                  header: 'Categoria',
                  primary: true,
                  cell: (enrollment) => <Link to={links.enrollment(enrollment.id)}>Categoria {enrollment.category}</Link>,
                },
                { header: 'Situação', cell: (enrollment) => <EnrollmentStatusBadge status={enrollment.status} /> },
                {
                  header: 'Serviço contratado',
                  cell: (enrollment) => <span className="tabular-nums">{enrollment.contracted_minutes ? formatMinutes(enrollment.contracted_minutes) : '—'}</span>,
                },
                ...(operate
                  ? [
                      {
                        header: 'Saldo de aulas',
                        cell: (enrollment: Enrollment) =>
                          enrollment.balance ? (
                            <Link to={links.enrollment(enrollment.id)} className="text-decoration-none">
                              <BalanceBadge available={enrollment.balance.available} hasPackage={enrollment.balance.has_package} />
                            </Link>
                          ) : (
                            '—'
                          ),
                      },
                    ]
                  : []),
                { header: 'Prática', cell: (enrollment) => <ReleaseBadge release={enrollment.practice_release} /> },
              ]}
            />
          )}
        </QueryState>
      </section>

      <RecordSection title="Histórico de aulas" count={lessons.length}>
        
        {lessonsError ? (
          <Alert variant="danger" role="alert">
            {lessonsError.message}
          </Alert>
        ) : lessonsLoading ? (
          <p className="text-secondary">Carregando aulas…</p>
        ) : lessons.length === 0 ? (
          <Alert variant="info">Nenhuma aula agendada para este aluno.</Alert>
        ) : (
          <>
            <DataTable
              rows={lessons.slice(0, lessonsShown)}
              getKey={(lesson) => lesson.id}
              columns={[
                { header: 'Data e hora', primary: true, cell: (lesson) => <RecordLink className="tabular-nums" to={links.lesson(lesson.id)} returnLabel="Voltar ao aluno">{formatDateTime(lesson.starts_at, organization.timezone)}</RecordLink> },
                { header: 'Instrutor', cell: (lesson) => lesson.instructor?.full_name ?? '—' },
                { header: 'Situação', cell: (lesson) => <LessonStatusBadge status={lesson.status} /> },
              ]}
            />
            {lessons.length > lessonsShown && (
              <div className="d-flex flex-wrap align-items-center gap-3">
                <span className="small text-secondary">
                  Mostrando {lessonsShown} de {lessons.length} aulas, da mais recente para a mais antiga.
                </span>
                <Button variant="outline-primary" size="sm" onClick={() => setLessonsShown((n) => n + LESSONS_STEP)}>
                  Mostrar mais
                </Button>
              </div>
            )}
          </>
        )}
      </RecordSection>

      {operate && <ExamsSummary organizationId={organization.id} timezone={organization.timezone} filter={{ studentId: student.id }} />}

      {operate && (
        <RecordSection title="Linha do tempo">
          
          <Timeline organizationId={organization.id} timezone={organization.timezone} scope={{ kind: 'student', id: student.id }} emptyMessage="Nenhum evento registrado para este aluno ainda." />
        </RecordSection>
      )}

      {operate && (
        <RecordSection title="Documentos" count={documents.data?.data.length}>
          <div id="documents-title">
            <PageHeader
              as="h2"
              title="Documentos"
              actions={
                <Button size="sm" onClick={() => setUploading(true)}>
                  <i className="bi bi-upload me-2" aria-hidden="true" />
                  Anexar documento
                </Button>
              }
            />
          </div>
          <QueryState query={documents} isEmpty={(d) => d.data.length === 0} empty="Nenhum documento anexado a este aluno.">
            {(data) => (
              <DataTable
                rows={data.data}
                getKey={(doc) => doc.id}
                columns={[
                  {
                    header: 'Documento',
                    primary: true,
                    cell: (doc) => (
                      <>
                        {DOCUMENT_TYPE_LABELS[doc.type]} <span className="text-secondary small fw-normal">v{doc.version}</span>
                      </>
                    ),
                  },
                  { header: 'Arquivo', cell: (doc) => <span className="text-break">{doc.original_name}</span> },
                  {
                    header: 'Situação',
                    cell: (doc, { mobile }) =>
                      // Documento substituído é histórico: não muda mais
                      doc.status === 'replaced' ? (
                        <DocumentStatusBadge status={doc.status} />
                      ) : (
                        <Form.Select
                          size={mobile ? undefined : 'sm'}
                          className="role-select"
                          aria-label={`Situação de ${DOCUMENT_TYPE_LABELS[doc.type]}`}
                          value={doc.status}
                          disabled={updateDocumentStatus.isPending}
                          onChange={(event) => updateDocumentStatus.mutate({ documentId: doc.id, status: event.target.value as DocumentStatus })}
                        >
                          {(['attached', 'verified', 'rejected'] as const).map((status) => (
                            <option key={status} value={status}>
                              {DOCUMENT_STATUS[status].label}
                            </option>
                          ))}
                        </Form.Select>
                      ),
                  },
                  { header: 'Validade', cell: (doc) => <span className="tabular-nums">{doc.expires_at ? formatDate(doc.expires_at) : 'Indeterminada'}</span> },
                  {
                    header: 'Ações',
                    actions: true,
                    cell: (doc, { mobile }) => (
                      <>
                        <Button
                          variant="outline-primary"
                          size={mobile ? undefined : 'sm'}
                          className={mobile ? 'flex-fill' : 'me-2'}
                          disabled={documentFile.isPending}
                          // A aba é aberta no clique (antes da resposta) para o navegador não bloquear
                          onClick={() => documentFile.mutate({ document: doc, mode: 'view', tab: window.open('', '_blank') })}
                        >
                          <i className="bi bi-eye me-1" aria-hidden="true" />
                          Visualizar
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size={mobile ? undefined : 'sm'}
                          className={mobile ? 'flex-fill me-2' : 'me-2'}
                          disabled={documentFile.isPending}
                          onClick={() => documentFile.mutate({ document: doc, mode: 'download', tab: null })}
                        >
                          <i className="bi bi-download me-1" aria-hidden="true" />
                          Baixar
                        </Button>
                        {doc.status !== 'replaced' && (
                          <Button variant="outline-secondary" size={mobile ? undefined : 'sm'} className={mobile ? 'flex-fill me-2' : 'me-2'} onClick={() => setReplacing(doc)}>
                            <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
                            Substituir
                          </Button>
                        )}
                        {(doc.version > 1 || doc.status === 'replaced') && (
                          <Button variant="link" size={mobile ? undefined : 'sm'} onClick={() => setVersionsOf(doc)}>
                            Versões
                          </Button>
                        )}
                      </>
                    ),
                  },
                ]}
              />
            )}
          </QueryState>
        </RecordSection>
      )}

      {operate && (
        <div className="form-narrow">
          <ArchiveCard
            noun="aluno"
            name={student.name}
            consequences="Matrículas, aulas, saldo, exames e documentos continuam no histórico. O CPF continua reservado a este cadastro: para voltar a atender, restaure-o em Alunos > Mostrar arquivados. Não é possível arquivar com aula ou exame agendado nem com matrícula em andamento."
            pending={archive.isPending}
            onArchive={() => archive.mutate(student.id, { onSuccess: () => navigate(links.students) })}
          />
        </div>
      )}

      {replacing && (
        <UploadDocumentModal
          organizationId={organization.id}
          owner={{ student_id: student.id, replaces_document_id: replacing.id, ...(replacing.qualification_process_id ? { qualification_process_id: replacing.qualification_process_id } : {}) }}
          replacing={{ type: replacing.type, label: DOCUMENT_TYPE_LABELS[replacing.type] }}
          onClose={() => setReplacing(null)}
        />
      )}
      {versionsOf && <DocumentVersionsModal organizationId={organization.id} document={versionsOf} onClose={() => setVersionsOf(null)} />}
      {uploading && <UploadDocumentModal organizationId={organization.id} owner={{ student_id: student.id }} onClose={() => setUploading(false)} />}
    </>
  )
}
