import { useState } from 'react'
import { Alert, Badge, Button, Form } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { organizationPaths } from '../config/paths'
import { useReassignLesson } from '../hooks/useAvailability'
import { useInstructors } from '../hooks/useInstructors'
import { useVehicles } from '../hooks/useVehicles'
import type { Commitment } from '../types/availability'
import { formatDateTime } from '../utils/formatDateTime'
import { DataTable } from './DataTable'

const ISSUE_LABELS = { blocked: 'Veículo bloqueado', crlv_expired: 'CRLV vencido na data', inactive: 'Veículo inativo' } as const

type CommitmentListProps = { organizationId: number; timezone: string; commitments: Commitment[]; canAct: boolean }

// Aulas e exames futuros afetados. Nada é cancelado sozinho: cada item tem sua providência (trocar, remarcar ou abrir).
export function CommitmentList({ organizationId, timezone, commitments, canAct }: CommitmentListProps) {
  const links = organizationPaths(organizationId)

  return (
    <DataTable
      rows={commitments}
      getKey={(c) => `${c.type}-${c.id}`}
      columns={[
        {
          header: 'Quando',
          primary: true,
          cell: (c) => (
            <Link to={c.type === 'lesson' ? links.lesson(c.id) : links.exam(c.id)} className="tabular-nums">
              {formatDateTime(c.starts_at, timezone)}
            </Link>
          ),
        },
        { header: 'Tipo', cell: (c) => <Badge bg={c.type === 'lesson' ? 'info' : 'primary'}>{c.type === 'lesson' ? 'Aula' : 'Exame'}</Badge> },
        { header: 'Aluno', cell: (c) => c.student ?? '—' },
        { header: 'Instrutor', cell: (c) => c.instructor?.name ?? '—' },
        { header: 'Veículo', cell: (c) => c.vehicle?.plate ?? '—' },
        {
          header: 'Situação',
          cell: (c) =>
            c.issues && c.issues.length > 0 ? (
              <span className="d-inline-flex flex-wrap gap-1 justify-content-end">
                {c.issues.map((issue) => (
                  <Badge key={issue} bg="warning" text="dark">
                    {ISSUE_LABELS[issue]}
                  </Badge>
                ))}
              </span>
            ) : (
              '—'
            ),
        },
        ...(canAct
          ? [
              {
                header: 'Providência',
                actions: true,
                cell: (c: Commitment) =>
                  c.type === 'lesson' ? (
                    <ReassignControls organizationId={organizationId} lessonId={c.id} />
                  ) : (
                    <Link to={links.exam(c.id)} className="btn btn-sm btn-outline-secondary">
                      Abrir exame
                    </Link>
                  ),
              },
            ]
          : []),
      ]}
    />
  )
}

// Troca veículo ou instrutor da aula, mantendo horário e saldo. A API confere bloqueios e conflitos de novo.
export function ReassignControls({ organizationId, lessonId, showLink = true, canSwapInstructor = true }: { organizationId: number; lessonId: number; showLink?: boolean; canSwapInstructor?: boolean }) {
  const links = organizationPaths(organizationId)
  const [mode, setMode] = useState<null | 'vehicle' | 'instructor'>(null)

  return (
    <div className="d-flex flex-column align-items-end gap-2">
      <div className="d-flex flex-wrap gap-2 justify-content-end">
        <Button size="sm" variant="outline-primary" onClick={() => setMode(mode === 'vehicle' ? null : 'vehicle')}>
          Trocar veículo
        </Button>
        {canSwapInstructor && (
          <Button size="sm" variant="outline-primary" onClick={() => setMode(mode === 'instructor' ? null : 'instructor')}>
            Trocar instrutor
          </Button>
        )}
        {showLink && (
          <Link to={links.lesson(lessonId)} className="btn btn-sm btn-outline-secondary">
            Remarcar ou cancelar
          </Link>
        )}
      </div>
      {mode && <ReassignForm organizationId={organizationId} lessonId={lessonId} mode={mode} onDone={() => setMode(null)} />}
    </div>
  )
}

function ReassignForm({ organizationId, lessonId, mode, onDone }: { organizationId: number; lessonId: number; mode: 'vehicle' | 'instructor'; onDone: () => void }) {
  const [value, setValue] = useState('')
  const reassign = useReassignLesson(organizationId)
  const vehicles = useVehicles(organizationId, { page: 1, all: true, status: 'active' })
  const instructors = useInstructors(organizationId, { page: 1, all: true, active: true }, mode === 'instructor')

  const submit = () =>
    reassign.mutate(mode === 'vehicle' ? { lessonId, vehicle_id: Number(value) } : { lessonId, instructor_id: Number(value) }, { onSuccess: onDone })

  return (
    <div className="d-grid gap-2 w-100" style={{ minWidth: 220 }}>
      <Form.Select size="sm" aria-label={mode === 'vehicle' ? 'Novo veículo' : 'Novo instrutor'} value={value} onChange={(event) => setValue(event.target.value)}>
        <option value="">{mode === 'vehicle' ? 'Escolha o veículo' : 'Escolha o instrutor'}</option>
        {mode === 'vehicle'
          ? vehicles.data?.data.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate} · {v.model}
              </option>
            ))
          : instructors.data?.data.map((i) => (
              <option key={i.id} value={i.id}>
                {i.full_name}
              </option>
            ))}
      </Form.Select>
      {reassign.error && (
        <Alert variant="danger" className="small py-1 px-2 mb-0" role="alert">
          {reassign.error.message}
        </Alert>
      )}
      <Button size="sm" disabled={value === '' || reassign.isPending} onClick={submit}>
        Aplicar troca
      </Button>
    </div>
  )
}
