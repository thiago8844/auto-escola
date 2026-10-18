import { useState } from 'react'
import { Alert, Badge, Button, Card } from 'react-bootstrap'
import { CommitmentList } from '../../components/CommitmentList'
import { QueryState } from '../../components/QueryState'
import { ReasonModal } from '../../components/ReasonModal'
import { WeeklyHoursEditor } from '../../components/WeeklyHoursEditor'
import { useInstructorAvailability, useReleaseBlock, useSaveWeeklyHours } from '../../hooks/useAvailability'
import type { AvailabilityBlock, InstructorAvailability, WeeklyHours } from '../../types/availability'
import type { Organization } from '../../types/organization'
import { formatDateTime } from '../../utils/formatDateTime'
import { summarizeHours } from '../../utils/summarizeHours'
import { BlockModal } from '../availability/BlockModal'

// Disponibilidade do instrutor neste espaço: regra de horário, bloqueios e compromissos futuros
export function InstructorAvailabilityPanel({ organization, instructorId }: { organization: Organization; instructorId: number }) {
  const query = useInstructorAvailability(organization.id, String(instructorId))
  const [blocking, setBlocking] = useState(false)

  return (
    <section className="mt-5" aria-labelledby="availability-heading">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
        <h2 id="availability-heading" className="h4 mb-0">
          Disponibilidade
        </h2>
        <Button variant="outline-secondary" onClick={() => setBlocking(true)}>
          <i className="bi bi-slash-circle me-2" aria-hidden="true" />
          Bloquear agenda
        </Button>
      </div>
      <QueryState query={query} isEmpty={() => false} empty={null}>
        {(data) => <Content organization={organization} instructorId={instructorId} data={data} />}
      </QueryState>
      {blocking && <BlockModal organization={organization} instructorId={instructorId} onClose={() => setBlocking(false)} />}
    </section>
  )
}

function Content({ organization, instructorId, data }: { organization: Organization; instructorId: number; data: InstructorAvailability }) {
  const [editing, setEditing] = useState(false)
  const [hours, setHours] = useState<WeeklyHours>(data.rule.weekly_hours ?? {})
  const [releasing, setReleasing] = useState<AvailabilityBlock | null>(null)
  const save = useSaveWeeklyHours(organization.id, instructorId)
  const release = useReleaseBlock(organization.id)

  const applied = data.rule.weekly_hours ?? data.rule.business_hours
  const personal = data.blocks.filter((b) => b.scope === 'personal')

  return (
    <div className="d-grid gap-4">
      <Card>
        <Card.Body>
          <Card.Title as="h3" className="h6 d-flex align-items-center gap-2">
            Horário de atendimento
            <Badge bg={data.rule.mode === 'free' ? 'secondary' : 'primary'}>{data.rule.mode === 'free' ? 'Agenda livre' : 'Com horário definido'}</Badge>
          </Card.Title>
          <p className="mb-2">{summarizeHours(applied)}</p>
          {data.rule.business_hours && data.rule.weekly_hours && <p className="small text-secondary">Vale o horário deste instrutor e também o do espaço: a aula precisa caber nos dois.</p>}
          {!editing ? (
            <Button variant="link" className="px-0" onClick={() => setEditing(true)}>
              {data.rule.weekly_hours ? 'Alterar horário do instrutor' : 'Definir horário do instrutor'}
            </Button>
          ) : (
            <>
              <WeeklyHoursEditor value={hours} onChange={setHours} />
              {save.error && (
                <Alert variant="danger" className="mt-2" role="alert">
                  {save.error.message}
                </Alert>
              )}
              <div className="d-flex flex-wrap gap-2 mt-3">
                <Button disabled={save.isPending} onClick={() => save.mutate(Object.keys(hours).length ? hours : null, { onSuccess: () => setEditing(false) })}>
                  Salvar horário
                </Button>
                <Button variant="outline-secondary" onClick={() => save.mutate(null, { onSuccess: () => { setHours({}); setEditing(false) } })} disabled={save.isPending}>
                  Voltar à agenda livre
                </Button>
                <Button variant="link" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
              <p className="small text-secondary mt-2 mb-0">Aulas fora do horário só entram com uma exceção justificada. Bloqueios continuam valendo.</p>
            </>
          )}
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Card.Title as="h3" className="h6">
            Bloqueios em andamento ou futuros
          </Card.Title>
          {data.blocks.length === 0 ? (
            <p className="text-secondary mb-0">Nenhum bloqueio. A agenda segue apenas as regras de horário.</p>
          ) : (
            <ul className="list-unstyled mb-0 d-grid gap-2">
              {data.blocks.map((block) => (
                <li key={block.id} className="d-flex flex-wrap align-items-center justify-content-between gap-2 border-bottom pb-2">
                  <div>
                    <Badge bg={block.scope === 'personal' ? 'info' : 'warning'} text={block.scope === 'personal' ? undefined : 'dark'} className="me-2">
                      {block.scope === 'personal' ? 'Pessoal' : 'Deste espaço'}
                    </Badge>
                    {block.kind_label}: {block.reason ?? 'indisponível'}
                    <div className="small text-secondary tabular-nums">
                      {formatDateTime(block.starts_at, organization.timezone)} até {formatDateTime(block.ends_at, organization.timezone)}
                    </div>
                  </div>
                  {block.scope === 'organization' && (
                    <Button size="sm" variant="outline-success" onClick={() => setReleasing(block)}>
                      Liberar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {personal.length > 0 && <p className="small text-secondary mt-2 mb-0">Indisponibilidade pessoal só pode ser alterada pelo próprio instrutor e vale em todos os espaços dele.</p>}
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <Card.Title as="h3" className="h6">
            Próximos compromissos neste espaço ({data.upcoming_count})
          </Card.Title>
          {data.upcoming.length === 0 ? (
            <p className="text-secondary mb-0">Nenhuma aula ou exame agendado.</p>
          ) : (
            <CommitmentList organizationId={organization.id} timezone={organization.timezone} commitments={data.upcoming} canAct />
          )}
        </Card.Body>
      </Card>

      {releasing && (
        <ReasonModal
          title="Liberar agenda do instrutor"
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
    </div>
  )
}
