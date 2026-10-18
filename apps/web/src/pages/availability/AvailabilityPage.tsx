import { useState } from 'react'
import { Badge, Button, Card, Nav } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { Pagination } from '../../components/Pagination'
import { QueryState } from '../../components/QueryState'
import { ReasonModal } from '../../components/ReasonModal'
import { PAGE_SIZE } from '../../config/organization'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useBlocks, useMaintenances, useReleaseBlock } from '../../hooks/useAvailability'
import { useClampPage, usePageParam } from '../../hooks/usePageParam'
import type { AvailabilityBlock } from '../../types/availability'
import { formatDate } from '../../utils/formatDate'
import { formatDateTime } from '../../utils/formatDateTime'
import { canOperate } from '../../utils/permissions'
import { NewMaintenanceModal } from '../vehicles/MaintenanceModals'
import { BlockModal } from './BlockModal'

// Visão única dos bloqueios e manutenções do espaço. O instrutor vê só a própria indisponibilidade.
export default function AvailabilityPage() {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const staff = canOperate(organization.role)
  const [tab, setTab] = useState<'blocks' | 'maintenance'>('blocks')
  const [page, setPage] = usePageParam()
  const [modal, setModal] = useState<null | 'block' | 'maintenance'>(null)
  const [releasing, setReleasing] = useState<AvailabilityBlock | null>(null)
  const release = useReleaseBlock(organization.id)

  const blocks = useBlocks(organization.id, { page, current: true })
  const maintenances = useMaintenances(organization.id, { page, status: 'scheduled' }, staff && tab === 'maintenance')
  useClampPage(page, (tab === 'blocks' ? blocks.data : maintenances.data)?.meta.last_page, setPage)

  return (
    <>
      <PageHeader
        title={staff ? 'Bloqueios e manutenção' : 'Minha indisponibilidade'}
        subtitle={staff ? 'Veículos e instrutores que não podem receber aulas em certos períodos.' : 'Períodos em que você não pode dar aulas. Vale em todos os seus espaços.'}
        actions={
          <>
            {staff && (
              <Button variant="outline-primary" onClick={() => setModal('maintenance')}>
                <i className="bi bi-wrench-adjustable me-2" aria-hidden="true" />
                Registrar manutenção
              </Button>
            )}
            <Button onClick={() => setModal('block')}>
              <i className="bi bi-slash-circle me-2" aria-hidden="true" />
              {staff ? 'Bloquear horários' : 'Registrar indisponibilidade'}
            </Button>
          </>
        }
      />

      {staff && (
        <Nav variant="pills" className="mb-3" activeKey={tab} onSelect={(key) => { setTab((key as typeof tab) ?? 'blocks'); setPage(1, true) }}>
          <Nav.Item>
            <Nav.Link eventKey="blocks">Bloqueios ativos</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link eventKey="maintenance">Manutenções em aberto</Nav.Link>
          </Nav.Item>
        </Nav>
      )}

      {tab === 'blocks' ? (
        <QueryState query={blocks} isEmpty={(d) => d.data.length === 0} empty="Nenhum bloqueio ativo. A agenda está liberada.">
          {(data) => (
            <>
              <DataTable
                rows={data.data}
                getKey={(b) => b.id}
                columns={[
                  {
                    header: 'Quem',
                    primary: true,
                    cell: (b) =>
                      b.vehicle ? (
                        <Link to={links.vehicle(b.vehicle.id)}>
                          {b.vehicle.plate} · {b.vehicle.model}
                        </Link>
                      ) : b.instructor ? (
                        staff ? <Link to={links.instructor(b.instructor.id)}>{b.instructor.full_name}</Link> : <span>{b.instructor.full_name}</span>
                      ) : (
                        'Instrutor'
                      ),
                  },
                  { header: 'Motivo', cell: (b) => `${b.kind_label}${b.reason ? `: ${b.reason}` : ''}` },
                  {
                    header: 'Período',
                    cell: (b) => (
                      <span className="tabular-nums">
                        {formatDateTime(b.starts_at, organization.timezone)} – {formatDateTime(b.ends_at, organization.timezone)}
                      </span>
                    ),
                  },
                  { header: 'Alcance', cell: (b) => <Badge bg={b.scope === 'personal' ? 'info' : 'secondary'}>{b.scope === 'personal' ? 'Pessoal' : 'Deste espaço'}</Badge> },
                  {
                    header: 'Ações',
                    actions: true,
                    cell: (b) =>
                      !b.external && (staff || b.scope === 'personal') ? (
                        <Button size="sm" variant="outline-success" onClick={() => setReleasing(b)}>
                          Liberar
                        </Button>
                      ) : null,
                  },
                ]}
              />
              <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </QueryState>
      ) : (
        <QueryState query={maintenances} isEmpty={(d) => d.data.length === 0} empty="Nenhuma manutenção em aberto.">
          {(data) => (
            <>
              <DataTable
                rows={data.data}
                getKey={(m) => m.id}
                columns={[
                  { header: 'Veículo', primary: true, cell: (m) => <Link to={links.vehicle(m.vehicle_id)}>{m.vehicle?.plate ?? 'Veículo'}</Link> },
                  { header: 'Serviço', cell: (m) => m.type },
                  { header: 'Data', cell: (m) => formatDate(m.scheduled_on) },
                  { header: 'Oficina', cell: (m) => m.provider ?? '—' },
                  { header: 'Agenda', cell: (m) => (m.block ? <Badge bg="warning" text="dark">Bloqueada</Badge> : '—') },
                ]}
              />
              <Pagination page={page} lastPage={data.meta.last_page} total={data.meta.total} perPage={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </QueryState>
      )}

      {!staff && (
        <Card className="mt-3">
          <Card.Body className="small text-secondary">
            Outros espaços veem apenas “instrutor indisponível” nesses horários, sem motivo nem detalhes.
          </Card.Body>
        </Card>
      )}

      {modal === 'block' && <BlockModal organization={organization} onClose={() => setModal(null)} />}
      {modal === 'maintenance' && <NewMaintenanceModal organization={organization} onClose={() => setModal(null)} />}
      {releasing && (
        <ReasonModal
          title="Liberar bloqueio"
          description="O bloqueio deixa de valer e o histórico é mantido."
          label="Observação (opcional)"
          submitLabel="Liberar"
          singleLine
          minLength={0}
          pending={release.isPending}
          error={release.error}
          onSubmit={(note) => release.mutate({ blockId: releasing.id, note: note || null }, { onSuccess: () => setReleasing(null) })}
          onClose={() => setReleasing(null)}
        />
      )}
    </>
  )
}
