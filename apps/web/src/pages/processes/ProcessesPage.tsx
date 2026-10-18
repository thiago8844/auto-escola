import { Link } from 'react-router-dom'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { ProcessStatusBadge, ReleaseBadge } from '../../components/StatusBadges'
import { PROCESS_TYPE_LABELS } from '../../config/domain'
import { PAGE_SIZE } from '../../config/organization'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import { useProcesses } from '../../hooks/useProcesses'

export default function ProcessesPage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const [page, setPage] = usePageParam()
  const query = useProcesses(organization.id, { page })
  useClampPage(page, query.data?.meta.last_page, setPage)

  return (
    <>
      <PageHeader title="Processos de habilitação" subtitle="Acompanhamento local de cada atendimento. Para criar um, abra o aluno." />

      <QueryState query={query} isEmpty={(data) => data.data.length === 0} empty="Nenhum processo cadastrado ainda.">
        {(data) => (
          <>
            <DataTable
              rows={data.data}
              getKey={(process) => process.id}
              columns={[
                {
                  header: 'Aluno',
                  primary: true,
                  cell: (process) => <Link to={links.process(process.id)}>{process.student?.name ?? `Processo ${process.id}`}</Link>,
                },
                { header: 'Tipo', cell: (process) => PROCESS_TYPE_LABELS[process.type] },
                { header: 'Categorias', cell: (process) => process.target_categories.join(', ') },
                { header: 'Situação', cell: (process) => <ProcessStatusBadge status={process.status} /> },
                { header: 'Prática', cell: (process) => <ReleaseBadge release={process.practice_release} /> },
              ]}
            />
            <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </QueryState>
    </>
  )
}
