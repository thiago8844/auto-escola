import { Link } from 'react-router-dom'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { EnrollmentStatusBadge, ReleaseBadge } from '../../components/StatusBadges'
import { PAGE_SIZE } from '../../config/organization'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useEnrollments } from '../../hooks/useEnrollments'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import { formatMinutes } from '../../utils/formatMinutes'

export default function EnrollmentsPage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const [page, setPage] = usePageParam()
  const query = useEnrollments(organization.id, page)
  useClampPage(page, query.data?.meta.last_page, setPage)

  return (
    <>
      <PageHeader title="Matrículas" subtitle="Para criar uma matrícula, abra o aluno e escolha “Nova matrícula”." />

      <QueryState query={query} isEmpty={(data) => data.data.length === 0} empty="Nenhuma matrícula cadastrada ainda.">
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
                {
                  header: 'Serviço contratado',
                  cell: (enrollment) => <span className="tabular-nums">{enrollment.contracted_minutes ? formatMinutes(enrollment.contracted_minutes) : '—'}</span>,
                },
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
