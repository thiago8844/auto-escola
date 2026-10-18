import { Badge, Button, Col, Form, Row } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { ArchivedToggle } from '../../components/ArchivedToggle'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { VehicleStatusBadge } from '../../components/StatusBadges'
import { VEHICLE_STATUS } from '../../config/domain'
import { PAGE_SIZE } from '../../config/organization'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useArchive } from '../../hooks/useArchive'
import { useUrlFilters, useUrlSearch } from '../../hooks/useUrlFilters'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import { useVehicles } from '../../hooks/useVehicles'
import type { VehicleStatus } from '../../types/vehicle'
import { formatDate } from '../../utils/formatDate'
import { canOperate } from '../../utils/permissions'
import { todayInTimeZone } from '../../utils/timezone'

export default function VehiclesPage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const [page, setPage] = usePageParam()
  const [text, setText, search] = useUrlSearch()
  const { values, set } = useUrlFilters(['situacao', 'arquivados'] as const)
  const status = values.situacao as VehicleStatus | ''
  const archived = values.arquivados === '1'
  const staff = canOperate(organization.role)
  const { restore } = useArchive(organization.id, 'vehicles')

  const query = useVehicles(organization.id, { page, search, status, archived })
  useClampPage(page, query.data?.meta.last_page, setPage)
  const today = todayInTimeZone(organization.timezone)
  const filtered = search !== '' || status !== '' || archived

  return (
    <>
      <PageHeader
        title="Veículos"
        actions={
          canOperate(organization.role) && (
            <Link to={links.vehicleNew} className="btn btn-primary">
              <i className="bi bi-plus-lg me-2" aria-hidden="true" />
              Novo veículo
            </Link>
          )
        }
      />

      <Row className="g-2 mb-4 align-items-center">
        <Col xs={12} sm={5}>
          <Form.Group controlId="vehicle-search">
            <Form.Label className="visually-hidden">Buscar por placa ou modelo</Form.Label>
            <Form.Control
              type="search"
              placeholder="Placa ou modelo"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </Form.Group>
        </Col>
        <Col xs={12} sm={4}>
          <Form.Group controlId="vehicle-status">
            <Form.Label className="visually-hidden">Situação</Form.Label>
            <Form.Select
              value={status}
              onChange={(event) => set('situacao', event.target.value)}
            >
              <option value="">Todas as situações</option>
              {Object.entries(VEHICLE_STATUS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
        {staff && (
          <Col xs={12} sm={3}>
            <ArchivedToggle id="vehicle-archived" checked={archived} onChange={(checked) => set('arquivados', checked ? '1' : '')} />
          </Col>
        )}
      </Row>

      <QueryState query={query} isEmpty={(data) => data.data.length === 0} empty={filtered ? 'Nenhum veículo encontrado com esses filtros.' : 'Nenhum veículo cadastrado ainda.'}>
        {(data) => (
          <>
            <DataTable
              rows={data.data}
              getKey={(vehicle) => vehicle.id}
              columns={[
                { header: 'Placa', primary: true, cell: (vehicle) => <Link to={links.vehicle(vehicle.id)}>{vehicle.plate}</Link> },
                { header: 'Modelo', cell: (vehicle) => [vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ') },
                { header: 'Categoria', cell: (vehicle) => vehicle.category },
                {
                  header: 'CRLV',
                  cell: (vehicle) =>
                    vehicle.crlv_expires_at ? (
                      <>
                        <span className="tabular-nums">{formatDate(vehicle.crlv_expires_at)}</span>{' '}
                        {vehicle.crlv_expires_at < today && (
                          <Badge bg="danger">
                            <i className="bi bi-exclamation-triangle-fill me-1" aria-hidden="true" />
                            Vencido
                          </Badge>
                        )}
                      </>
                    ) : (
                      '—'
                    ),
                },
                { header: 'Situação', cell: (vehicle) => <VehicleStatusBadge status={vehicle.status} /> },
                ...(archived
                  ? [
                      {
                        header: 'Ações',
                        actions: true,
                        cell: (vehicle: (typeof data.data)[number]) => (
                          <Button size="sm" variant="outline-primary" disabled={restore.isPending} onClick={() => restore.mutate(vehicle.id)}>
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
