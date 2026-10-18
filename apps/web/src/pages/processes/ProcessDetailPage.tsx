import { useState } from 'react'
import { Badge, Button, Card, Form } from 'react-bootstrap'
import { Link, useParams } from 'react-router-dom'
import { DataTable } from '../../components/DataTable'
import { PageHeader } from '../../components/PageHeader'
import { QueryState } from '../../components/QueryState'
import { ReleasePanel } from '../../components/ReleasePanel'
import { ChecklistStatusBadge } from '../../components/StatusBadges'
import { CHECKLIST_SOURCE_LABELS, CHECKLIST_TYPE_LABELS, PROCESS_STATUS, PROCESS_TYPE_LABELS } from '../../config/domain'
import { organizationPaths } from '../../config/paths'
import { useActiveOrganization } from '../../hooks/useActiveOrganization'
import { useProcess, useUpdateProcessStatus } from '../../hooks/useProcesses'
import { notify } from '../../stores/toastStore'
import type { ChecklistItem, ProcessStatus, QualificationProcess } from '../../types/process'
import { formatDate } from '../../utils/formatDate'
import { ChecklistItemModal } from './ChecklistItemModal'

export default function ProcessDetailPage() {
  const { processId = '' } = useParams()
  const organization = useActiveOrganization()
  const query = useProcess(organization.id, processId)

  return (
    <QueryState query={query} isEmpty={() => false} empty={null}>
      {(process) => <ProcessDetail process={process} />}
    </QueryState>
  )
}

function ProcessDetail({ process }: { process: QualificationProcess }) {
  const organization = useActiveOrganization()
  const links = organizationPaths(organization.id)
  const updateStatus = useUpdateProcessStatus(organization.id, String(process.id))
  const [editing, setEditing] = useState<ChecklistItem | null>(null)

  return (
    <>
      <PageHeader
        title={PROCESS_TYPE_LABELS[process.type]}
        subtitle={process.student && <Link to={links.student(process.student.id)}>{process.student.name}</Link>}
      />

      <Card className="mb-4">
        <Card.Body>
          <dl className="row mb-0">
            <dt className="col-sm-4 col-md-3">Situação</dt>
            <dd className="col-sm-8 col-md-9">
              <Form.Select
                className="form-narrow"
                aria-label="Situação do processo"
                value={process.status}
                disabled={updateStatus.isPending}
                onChange={(event) =>
                  updateStatus.mutate(event.target.value as ProcessStatus, { onSuccess: () => notify.success('Situação atualizada.') })
                }
              >
                {Object.entries(PROCESS_STATUS).map(([value, { label }]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Form.Select>
            </dd>
            <dt className="col-sm-4 col-md-3">UF / município</dt>
            <dd className="col-sm-8 col-md-9">
              {process.uf}
              {process.municipality ? ` · ${process.municipality}` : ''}
            </dd>
            <dt className="col-sm-4 col-md-3">Categorias</dt>
            <dd className="col-sm-8 col-md-9">
              {process.current_categories.length > 0 && `Atuais: ${process.current_categories.join(', ')} · `}
              Pretendidas: {process.target_categories.join(', ')}
            </dd>
            <dt className="col-sm-4 col-md-3">RENACH</dt>
            <dd className="col-sm-8 col-md-9 text-break">{process.renach ?? '—'}</dd>
            <dt className="col-sm-4 col-md-3">Protocolo</dt>
            <dd className="col-sm-8 col-md-9 text-break">{process.protocol ?? '—'}</dd>
            <dt className="col-sm-4 col-md-3">Abertura</dt>
            <dd className="col-sm-8 col-md-9 mb-0">{process.opened_at ? formatDate(process.opened_at) : '—'}</dd>
          </dl>
        </Card.Body>
      </Card>

      <section aria-labelledby="checklist-title">
        <h2 id="checklist-title" className="h4 mb-3">
          Checklist de liberação para a prática
        </h2>
        {process.practice_release && (
          <div className="mb-3">
            <ReleasePanel release={process.practice_release} />
          </div>
        )}
        <p className="small text-secondary">Só itens conferidos (com origem confiável) ou marcados como “não se aplica” (com motivo) liberam a prática.</p>

        <DataTable
          rows={process.checklist ?? []}
          getKey={(item) => item.id}
          columns={[
            {
              header: 'Item',
              primary: true,
              cell: (item) => (
                <>
                  {CHECKLIST_TYPE_LABELS[item.type]}{' '}
                  {item.required && (
                    <Badge bg="light" text="dark" className="border fw-normal">
                      Obrigatório
                    </Badge>
                  )}
                </>
              ),
            },
            { header: 'Situação', cell: (item) => <ChecklistStatusBadge status={item.status} /> },
            {
              header: 'Origem',
              cell: (item) => (
                <>
                  {item.source ? CHECKLIST_SOURCE_LABELS[item.source] : '—'}
                  {item.reference && <span className="d-block small text-secondary text-break">{item.reference}</span>}
                </>
              ),
            },
            {
              header: 'Conferido por',
              cell: (item) => (item.checked_by ? `${item.checked_by.name}${item.checked_at ? ` em ${formatDate(item.checked_at)}` : ''}` : '—'),
            },
            {
              header: 'Ações',
              actions: true,
              cell: (item, { mobile }) => (
                <Button variant="outline-primary" size={mobile ? undefined : 'sm'} className={mobile ? 'flex-fill' : undefined} onClick={() => setEditing(item)}>
                  Atualizar
                </Button>
              ),
            },
          ]}
        />
      </section>

      {editing && <ChecklistItemModal organizationId={organization.id} processId={String(process.id)} item={editing} onClose={() => setEditing(null)} />}
    </>
  )
}
