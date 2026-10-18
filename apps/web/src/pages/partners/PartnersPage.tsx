import { Alert, Button, Form } from 'react-bootstrap'
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
import { usePartners } from '../../hooks/usePartners'
import { useUrlFilters, useUrlSearch } from '../../hooks/useUrlFilters'
import { formatDocument } from '../../utils/formatDocument'

export default function PartnersPage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const [page, setPage] = usePageParam()
  const [text, setText, search] = useUrlSearch()
  const { values, set } = useUrlFilters(['arquivados'] as const)
  const archived = values.arquivados === '1'
  const { restore } = useArchive(organization.id, 'partners')

  const query = usePartners(organization.id, { page, search, archived })
  useClampPage(page, query.data?.meta.last_page, setPage)

  return (
    <>
      <PageHeader
        title="Parceiros"
        actions={
          <Link to={links.partnerNew} className="btn btn-primary">
            <i className="bi bi-plus-lg me-2" aria-hidden="true" />
            Novo parceiro
          </Link>
        }
      />
      <Alert variant="secondary">
        Parceiros são auto escolas externas, em nome das quais um instrutor autônomo atende. Eles não têm acesso ao sistema.
      </Alert>

      <div className="d-flex flex-wrap align-items-end gap-3 mb-4">
        <Form.Group controlId="partner-search" className="flex-grow-1 form-narrow">
          <Form.Label className="visually-hidden">Buscar parceiro por nome</Form.Label>
          <Form.Control type="search" placeholder="Buscar por nome" value={text} onChange={(event) => setText(event.target.value)} />
        </Form.Group>
        <ArchivedToggle id="partner-archived" checked={archived} onChange={(checked) => set('arquivados', checked ? '1' : '')} />
      </div>

      <QueryState
        query={query}
        isEmpty={(data) => data.data.length === 0}
        empty={archived ? 'Nenhum parceiro arquivado.' : search ? `Nenhum parceiro encontrado para "${search}".` : 'Nenhum parceiro cadastrado ainda.'}
      >
        {(data) => (
          <>
            <DataTable
              rows={data.data}
              getKey={(partner) => partner.id}
              columns={[
                { header: 'Nome', primary: true, cell: (partner) => partner.name },
                { header: 'CPF/CNPJ', cell: (partner) => <span className="tabular-nums">{partner.document ? formatDocument(partner.document) : '—'}</span> },
                { header: 'E-mail', cell: (partner) => <span className="text-break">{partner.email ?? '—'}</span> },
                { header: 'Telefone', cell: (partner) => <span className="tabular-nums">{partner.phone ?? '—'}</span> },
                ...(archived
                  ? [
                      {
                        header: 'Ações',
                        actions: true,
                        cell: (partner: (typeof data.data)[number]) => (
                          <Button size="sm" variant="outline-primary" disabled={restore.isPending} onClick={() => restore.mutate(partner.id)}>
                            Restaurar
                          </Button>
                        ),
                      },
                    ]
                  : []),
              ]}
              open={{ to: (partner) => links.partner(partner.id), label: (partner) => partner.name }}
            />
            <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </QueryState>
    </>
  )
}
