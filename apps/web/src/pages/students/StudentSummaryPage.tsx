import { Button, Card, Table } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { EXAM_STATUS, ENROLLMENT_STATUS, ISSUANCE_STATUS, PROCESS_STATUS, PROCESS_TYPE_LABELS } from '../../config/domain'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useStudentSummary } from '../../hooks/useReports'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDate } from '../../utils/formatDate'
import { formatMinutes } from '../../utils/formatMinutes'

// Resumo do aluno para atendimento e impressão (o navegador gera o PDF pela impressão)
export default function StudentSummaryPage() {
  const { studentId = '' } = useParams()
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const query = useStudentSummary(organization.id, studentId)

  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(summary) => (
        <div className="print-area">
          <PageHeader
            title={`Resumo de ${summary.student.name}`}
            subtitle={
              <span className="d-print-none">
                <Link to={links.student(summary.student.id)}>Voltar ao aluno</Link>
              </span>
            }
            actions={
              <Button className="d-print-none" onClick={() => window.print()}>
                <i className="bi bi-printer me-2" aria-hidden="true" />
                Imprimir
              </Button>
            }
          />
          <p className="d-none d-print-block small">
            {organization.name} · emitido em {formatDate(new Date().toISOString(), organization.timezone)} · telefone {summary.student.phone ?? '—'}
          </p>

          <section className="mb-4">
            <h2 className="h5">Contratação e minutos</h2>
            <div className="table-responsive d-none d-md-block d-print-block">
              <Table size="sm" className="align-middle">
                <thead>
                  <tr>
                    <th scope="col">Matrícula</th>
                    <th scope="col">Situação</th>
                    <th scope="col">Contratado</th>
                    <th scope="col">Reservado</th>
                    <th scope="col">Realizado</th>
                    <th scope="col">Consumido</th>
                    <th scope="col">Disponível</th>
                    <th scope="col">Faltas</th>
                    <th scope="col">Cancel.</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.enrollments.map((e) => (
                    <tr key={e.id}>
                      <td>
                        {e.category}
                        {e.partner && <span className="d-block small text-secondary">{e.partner}</span>}
                        {e.price_cents !== null && <span className="d-block small text-secondary">{formatCurrency(e.price_cents / 100)}</span>}
                      </td>
                      <td>{ENROLLMENT_STATUS[e.status as keyof typeof ENROLLMENT_STATUS]?.label ?? e.status}</td>
                      <td className="tabular-nums">{formatMinutes(e.minutes.contracted)}</td>
                      <td className="tabular-nums">{formatMinutes(e.minutes.reserved)}</td>
                      <td className="tabular-nums">{formatMinutes(e.minutes.realized)}</td>
                      <td className="tabular-nums">{formatMinutes(e.minutes.consumed)}</td>
                      <td className="tabular-nums fw-semibold">{formatMinutes(e.minutes.available)}</td>
                      <td className="tabular-nums">{e.lessons.missed}</td>
                      <td className="tabular-nums">{e.lessons.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <div className="d-md-none d-print-none d-grid gap-3">{summary.enrollments.map((e) => <Card key={e.id}><Card.Body><h3 className="h6">Categoria {e.category}</h3><p className="small">{ENROLLMENT_STATUS[e.status as keyof typeof ENROLLMENT_STATUS]?.label ?? e.status}</p><dl className="row small mb-0">{[['Contratado', e.minutes.contracted], ['Reservado', e.minutes.reserved], ['Realizado', e.minutes.realized], ['Consumido', e.minutes.consumed], ['Disponível', e.minutes.available]].map(([label, minutes]) => <div className="d-flex justify-content-between mb-1" key={label}><dt>{label}</dt><dd className="mb-0">{formatMinutes(Number(minutes))}</dd></div>)}</dl></Card.Body></Card>)}</div>
            <p className="small text-secondary">Realizado = tempo de instrução; consumido = o que foi descontado do pacote (pode incluir faltas cobradas).</p>
          </section>

          <section className="mb-4">
            <h2 className="h5">Processo e emissão</h2>
            {summary.processes.length === 0 ? (
              <p className="text-secondary">Sem processo de habilitação vinculado.</p>
            ) : (
              <ul className="list-unstyled">
                {summary.processes.map((p) => (
                  <li key={p.id} className="mb-2">
                    <strong>{PROCESS_TYPE_LABELS[p.type as keyof typeof PROCESS_TYPE_LABELS] ?? p.type}</strong> · {PROCESS_STATUS[p.status as keyof typeof PROCESS_STATUS]?.label ?? p.status} ·{' '}
                    {ISSUANCE_STATUS[p.issuance_status as keyof typeof ISSUANCE_STATUS]?.label ?? p.issuance_status} · prática {p.practice_released ? 'liberada' : 'bloqueada'}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mb-4">
            <h2 className="h5">Exames</h2>
            {summary.exams.length === 0 ? (
              <p className="text-secondary">Nenhum exame registrado.</p>
            ) : (
              <ul className="list-unstyled">
                {summary.exams.map((x, index) => (
                  <li key={index}>
                    {formatDate(x.date)} · {x.category}, tentativa {x.attempt}: <strong>{EXAM_STATUS[x.status].label}</strong>
                    {x.location && <span className="text-secondary"> · {x.location}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="h5">Evolução recente</h2>
            {summary.evolution.length === 0 ? (
              <p className="text-secondary">Nenhuma evolução registrada.</p>
            ) : (
              summary.evolution.map((item) => (
                <Card key={item.date + item.text} className="mb-2">
                  <Card.Body className="py-2">
                    <div className="small text-secondary">{formatDate(item.date)}</div>
                    {item.text}
                  </Card.Body>
                </Card>
              ))
            )}
          </section>
        </div>
      )}
    </QueryState>
  )
}
