import { Button } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { DataTable } from '../../components/DataTable'
import { QueryState } from '../../components/QueryState'
import { ExamStatusBadge } from '../../components/StatusBadges'
import { organizationPaths } from '../../config/paths'
import { useExams } from '../../hooks/useExams'
import { formatDateTime } from '../../utils/formatDateTime'

type ExamsSummaryProps = { organizationId: number; timezone: string; filter: { processId?: number; studentId?: number }; onSchedule?: () => void }

// Histórico de tentativas de exame de um processo ou aluno (nenhuma tentativa é sobrescrita)
export function ExamsSummary({ organizationId, timezone, filter, onSchedule }: ExamsSummaryProps) {
  const links = organizationPaths(organizationId)
  const query = useExams(organizationId, { page: 1, perPage: 100, order: 'asc', ...filter })

  return (
    <section aria-labelledby="exams-summary-title" className="mb-5">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h2 id="exams-summary-title" className="h4 mb-0">
          Exames práticos
        </h2>
        {onSchedule && (
          <Button size="sm" onClick={onSchedule}>
            <i className="bi bi-plus-lg me-1" aria-hidden="true" />
            Agendar exame
          </Button>
        )}
      </div>
      <QueryState query={query} isEmpty={(d) => d.data.length === 0} empty="Nenhuma tentativa de exame registrada.">
        {(data) => (
          <DataTable
            rows={data.data}
            getKey={(exam) => exam.id}
            columns={[
              {
                header: 'Tentativa',
                primary: true,
                cell: (exam) => (
                  <Link to={links.exam(exam.id)}>
                    {exam.category} · tentativa {exam.attempt_number}
                  </Link>
                ),
              },
              { header: 'Data e hora', cell: (exam) => <span className="tabular-nums">{formatDateTime(exam.scheduled_at, timezone)}</span> },
              { header: 'Local', cell: (exam) => exam.location ?? '—' },
              { header: 'Situação', cell: (exam) => <ExamStatusBadge status={exam.status} /> },
              { header: 'Remarcações', cell: (exam) => exam.reschedule_count ?? 0 },
            ]}
          />
        )}
      </QueryState>
    </section>
  )
}
