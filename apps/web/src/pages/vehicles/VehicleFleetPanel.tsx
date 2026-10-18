import { useState } from 'react'
import { Alert, Badge, Button, Card } from 'react-bootstrap'
import { CommitmentList } from '../../components/CommitmentList'
import { QueryState } from '../../components/QueryState'
import { ReasonModal } from '../../components/ReasonModal'
import { DOCUMENT_STATUS, DOCUMENT_TYPE_LABELS } from '../../config/domain'
import { useCancelMaintenance, useReleaseBlock, useVehicleOverview } from '../../hooks/useAvailability'
import { useDocumentFile } from '../../hooks/useDocuments'
import type { AvailabilityBlock, Maintenance } from '../../types/availability'
import type { DocumentStatus, DocumentType } from '../../types/document'
import type { Organization } from '../../types/organization'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDate } from '../../utils/formatDate'
import { formatDateTime } from '../../utils/formatDateTime'
import { BlockModal } from '../availability/BlockModal'
import { UploadDocumentModal } from '../students/UploadDocumentModal'
import { CompleteMaintenanceModal, NewMaintenanceModal } from './MaintenanceModals'

const MAINTENANCE_STATUS = {
  scheduled: { label: 'Em aberto', bg: 'warning' },
  done: { label: 'Concluída', bg: 'success' },
  cancelled: { label: 'Cancelada', bg: 'secondary' },
} as const

// Painel da frota no detalhe do veículo: ações diretas no topo e, abaixo, tudo o que afeta a disponibilidade dele
export function VehicleFleetPanel({ organization, vehicleId }: { organization: Organization; vehicleId: number }) {
  const query = useVehicleOverview(organization.id, String(vehicleId))
  const [modal, setModal] = useState<null | 'block' | 'maintenance' | 'document'>(null)
  const [replacing, setReplacing] = useState<{ id: number; type: DocumentType } | null>(null)
  const file = useDocumentFile(organization.id)
  const [completing, setCompleting] = useState<Maintenance | null>(null)
  const [cancelling, setCancelling] = useState<Maintenance | null>(null)
  const [releasing, setReleasing] = useState<AvailabilityBlock | null>(null)
  const release = useReleaseBlock(organization.id)
  const cancel = useCancelMaintenance(organization.id)

  return (
    <section className="mt-5" aria-labelledby="fleet-heading">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h2 id="fleet-heading" className="h4 mb-0">
          Disponibilidade e manutenção
        </h2>
        <div className="d-flex flex-wrap gap-2">
          <Button variant="outline-primary" onClick={() => setModal('maintenance')}>
            <i className="bi bi-wrench-adjustable me-2" aria-hidden="true" />
            Registrar manutenção
          </Button>
          <Button variant="outline-secondary" onClick={() => setModal('block')}>
            <i className="bi bi-slash-circle me-2" aria-hidden="true" />
            Bloquear horários
          </Button>
        </div>
      </div>

      <QueryState query={query} isEmpty={() => false} empty={null}>
        {(overview) => {
          const activeBlocks = overview.blocks.filter((b) => b.status === 'active' && new Date(b.ends_at) > new Date())
          const affected = overview.commitments.filter((c) => c.issues && c.issues.length > 0)

          return (
            <div className="d-grid gap-4">
              {overview.maintenance_due.map(({ maintenance, state, reasons }) => (
                <Alert key={maintenance.id} variant={state === 'overdue' ? 'danger' : 'warning'} className="mb-0">
                  <i className="bi bi-wrench-adjustable me-2" aria-hidden="true" />
                  <strong>{maintenance.type}: revisão {state === 'overdue' ? 'vencida' : 'próxima'}</strong>
                  {maintenance.next_due_date && reasons.includes('date') && <> · até {formatDate(maintenance.next_due_date)}</>}
                  {maintenance.next_due_km !== null && reasons.includes('km') && <> · aos {maintenance.next_due_km.toLocaleString('pt-BR')} km</>}
                </Alert>
              ))}

              {activeBlocks.length > 0 && (
                <Alert variant="warning" className="mb-0">
                  <i className="bi bi-slash-circle me-2" aria-hidden="true" />
                  <strong>Veículo com bloqueio na agenda.</strong> Novas reservas nesses períodos são recusadas até a liberação.
                </Alert>
              )}

              {affected.length > 0 && (
                <Card border="warning">
                  <Card.Body>
                    <Card.Title as="h3" className="h6">
                      <i className="bi bi-exclamation-triangle-fill text-warning me-2" aria-hidden="true" />
                      {affected.length} {affected.length === 1 ? 'compromisso afetado' : 'compromissos afetados'}
                    </Card.Title>
                    <p className="small text-secondary">Aulas e exames que não poderão acontecer como agendado. Escolha uma providência para cada um.</p>
                    <CommitmentList organizationId={organization.id} timezone={organization.timezone} commitments={affected} canAct />
                  </Card.Body>
                </Card>
              )}

              <Card>
                <Card.Body>
                  <Card.Title as="h3" className="h6">
                    Bloqueios de agenda
                  </Card.Title>
                  {overview.blocks.length === 0 ? (
                    <p className="text-secondary mb-0">Nenhum bloqueio registrado.</p>
                  ) : (
                    <ul className="list-unstyled mb-0 d-grid gap-2">
                      {overview.blocks.map((block) => (
                        <li key={block.id} className="d-flex flex-wrap align-items-center justify-content-between gap-2 border-bottom pb-2">
                          <div>
                            <div>
                              <Badge bg={block.status === 'active' ? 'warning' : 'secondary'} text={block.status === 'active' ? 'dark' : undefined} className="me-2">
                                {block.status === 'active' ? 'Ativo' : 'Liberado'}
                              </Badge>
                              {block.kind_label}: {block.reason}
                            </div>
                            <div className="small text-secondary tabular-nums">
                              {formatDateTime(block.starts_at, organization.timezone)} até {formatDateTime(block.ends_at, organization.timezone)}
                              {block.created_by && <> · por {block.created_by.name}</>}
                              {block.released_at && <> · liberado em {formatDateTime(block.released_at, organization.timezone)}</>}
                            </div>
                          </div>
                          {block.status === 'active' && (
                            <Button size="sm" variant="outline-success" onClick={() => setReleasing(block)}>
                              Liberar
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card.Body>
              </Card>

              <Card>
                <Card.Body>
                  <Card.Title as="h3" className="h6">
                    Manutenções
                  </Card.Title>
                  {overview.maintenances.length === 0 ? (
                    <p className="text-secondary mb-0">Nenhuma manutenção registrada.</p>
                  ) : (
                    <ul className="list-unstyled mb-0 d-grid gap-2">
                      {overview.maintenances.map((m) => (
                        <li key={m.id} className="d-flex flex-wrap align-items-center justify-content-between gap-2 border-bottom pb-2">
                          <div>
                            <div>
                              <Badge bg={MAINTENANCE_STATUS[m.status].bg} className="me-2">
                                {MAINTENANCE_STATUS[m.status].label}
                              </Badge>
                              {m.type}
                              {m.provider && <span className="text-secondary"> · {m.provider}</span>}
                            </div>
                            <div className="small text-secondary tabular-nums">
                              {formatDate(m.performed_on ?? m.scheduled_on)}
                              {m.odometer_km !== null && <> · {m.odometer_km.toLocaleString('pt-BR')} km</>}
                              {(m.actual_cost_cents ?? m.estimated_cost_cents) !== null && (
                                <>
                                  {' '}
                                  · {m.actual_cost_cents !== null ? 'custo' : 'estimado'} {formatCurrency((m.actual_cost_cents ?? m.estimated_cost_cents ?? 0) / 100)}
                                </>
                              )}
                              {m.next_due_date && <> · próxima em {formatDate(m.next_due_date)}</>}
                              {m.next_due_km !== null && <> · próxima aos {m.next_due_km.toLocaleString('pt-BR')} km</>}
                            </div>
                          </div>
                          {m.status === 'scheduled' && (
                            <div className="d-flex gap-2">
                              <Button size="sm" variant="success" onClick={() => setCompleting(m)}>
                                Concluir
                              </Button>
                              <Button size="sm" variant="outline-secondary" onClick={() => setCancelling(m)}>
                                Cancelar
                              </Button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </Card.Body>
              </Card>

              <Card>
                <Card.Body>
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
                    <Card.Title as="h3" className="h6 mb-0">
                      Documentos e versões
                    </Card.Title>
                    <Button size="sm" variant="outline-primary" onClick={() => setModal('document')}>
                      <i className="bi bi-upload me-1" aria-hidden="true" />
                      Anexar CRLV ou documento
                    </Button>
                  </div>
                  {overview.documents.length === 0 ? (
                    <p className="text-secondary mb-0">Nenhum documento anexado a este veículo.</p>
                  ) : (
                    <ul className="list-unstyled mb-0 d-grid gap-1">
                      {overview.documents.map((doc) => (
                        <li key={doc.id} className="d-flex flex-wrap justify-content-between gap-2">
                          <span>
                            {DOCUMENT_TYPE_LABELS[doc.type as DocumentType] ?? doc.type} · v{doc.version}
                            {doc.expires_at && <span className="text-secondary"> · vale até {formatDate(doc.expires_at)}</span>}
                          </span>
                          <span className="d-inline-flex align-items-center gap-2">
                            <Badge bg={DOCUMENT_STATUS[doc.status as DocumentStatus]?.bg ?? 'secondary'}>{DOCUMENT_STATUS[doc.status as DocumentStatus]?.label ?? doc.status}</Badge>
                            <Button size="sm" variant="link" className="p-0" disabled={file.isPending} onClick={() => file.mutate({ document: doc as never, mode: 'view', tab: window.open('', '_blank') })}>
                              Ver
                            </Button>
                            {doc.status !== 'replaced' && (
                              <Button size="sm" variant="link" className="p-0" onClick={() => setReplacing({ id: doc.id, type: doc.type as DocumentType })}>
                                Substituir
                              </Button>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card.Body>
              </Card>
            </div>
          )
        }}
      </QueryState>

      {modal === 'document' && (
        <UploadDocumentModal organizationId={organization.id} owner={{ vehicle_id: vehicleId }} defaultType="vehicle_registration" title="Anexar documento do veículo" onClose={() => setModal(null)} />
      )}
      {replacing && (
        <UploadDocumentModal
          organizationId={organization.id}
          owner={{ vehicle_id: vehicleId, replaces_document_id: replacing.id }}
          replacing={{ type: replacing.type, label: DOCUMENT_TYPE_LABELS[replacing.type] }}
          onClose={() => setReplacing(null)}
        />
      )}
      {modal === 'block' && <BlockModal organization={organization} vehicleId={vehicleId} onClose={() => setModal(null)} />}
      {modal === 'maintenance' && <NewMaintenanceModal organization={organization} vehicleId={vehicleId} onClose={() => setModal(null)} />}
      {completing && <CompleteMaintenanceModal organization={organization} maintenance={completing} onClose={() => setCompleting(null)} />}
      {releasing && (
        <ReasonModal
          title="Liberar veículo"
          description={<>O bloqueio “{releasing.reason}” deixa de valer e o histórico é mantido. Novas reservas voltam a ser aceitas.</>}
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
      {cancelling && (
        <ReasonModal
          title={`Cancelar manutenção: ${cancelling.type}`}
          description="O bloqueio de agenda ligado a ela também é liberado."
          label="Motivo"
          submitLabel="Cancelar manutenção"
          singleLine
          pending={cancel.isPending}
          error={cancel.error}
          onSubmit={(reason) => cancel.mutate({ id: cancelling.id, reason }, { onSuccess: () => setCancelling(null) })}
          onClose={() => setCancelling(null)}
        />
      )}
    </section>
  )
}
