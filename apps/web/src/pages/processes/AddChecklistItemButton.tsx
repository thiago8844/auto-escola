import { useState } from 'react'
import { Alert, Button, Form } from 'react-bootstrap'
import { CHECKLIST_TYPE_LABELS } from '../../config/domain'
import { useAddChecklistItem } from '../../hooks/useProcesses'
import type { ChecklistItemType } from '../../types/enrollment'
import type { ChecklistItem } from '../../types/process'

// Acrescenta uma exigência ao checklist. Exigência nunca é ocultada: para dispensar, marque “não se aplica” com motivo.
export function AddChecklistItem({ organizationId, processId, existing }: { organizationId: number; processId: string; existing: ChecklistItem[] }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('')
  const add = useAddChecklistItem(organizationId, processId)
  const available = (Object.keys(CHECKLIST_TYPE_LABELS) as ChecklistItemType[]).filter((t) => !existing.some((item) => item.type === t))

  if (available.length === 0) return null
  if (!open) {
    return (
      <Button variant="outline-primary" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        <i className="bi bi-plus-lg me-1" aria-hidden="true" />
        Adicionar exigência
      </Button>
    )
  }

  return (
    <div className="mt-3 d-flex flex-wrap gap-2 align-items-end">
      <Form.Group controlId="add-checklist-type">
        <Form.Label className="small mb-1">Nova exigência</Form.Label>
        <Form.Select size="sm" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Escolha</option>
          {available.map((t) => (
            <option key={t} value={t}>
              {CHECKLIST_TYPE_LABELS[t]}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
      <Button size="sm" disabled={type === '' || add.isPending} onClick={() => add.mutate(type, { onSuccess: () => { setOpen(false); setType('') } })}>
        Adicionar
      </Button>
      <Button size="sm" variant="link" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
      {add.error && (
        <Alert variant="danger" className="w-100 mb-0 py-1 small" role="alert">
          {add.error.message}
        </Alert>
      )}
    </div>
  )
}
