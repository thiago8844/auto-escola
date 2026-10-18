import { useState } from 'react'
import { Alert, Form } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { PAGE_SIZE } from '../../config/organization'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import { usePartners } from '../../hooks/usePartners'
import { formatDocument } from '../../utils/formatDocument'

export default function PartnersPage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const [page, setPage] = usePageParam()
  const [text, setText] = useState('')
  const search = useDebouncedValue(text.trim())

  const query = usePartners(organization.id, { page, search })
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

      <Form.Group controlId="partner-search" className="mb-4 form-narrow">
        <Form.Label className="visually-hidden">Buscar parceiro por nome</Form.Label>
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

      <QueryState query={query} isEmpty={(data) => data.data.length === 0} empty={search ? `Nenhum parceiro encontrado para "${search}".` : 'Nenhum parceiro cadastrado ainda.'}>
        {(data) => (
          <>
            <DataTable
              rows={data.data}
              getKey={(partner) => partner.id}
              columns={[
                { header: 'Nome', primary: true, cell: (partner) => <Link to={links.partner(partner.id)}>{partner.name}</Link> },
                { header: 'CPF/CNPJ', cell: (partner) => <span className="tabular-nums">{partner.document ? formatDocument(partner.document) : '—'}</span> },
                { header: 'E-mail', cell: (partner) => <span className="text-break">{partner.email ?? '—'}</span> },
                { header: 'Telefone', cell: (partner) => <span className="tabular-nums">{partner.phone ?? '—'}</span> },
              ]}
            />
            <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </QueryState>
    </>
  )
}
