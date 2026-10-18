import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Modal } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { FormField } from '../../components/FormField'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { CHECKLIST_SOURCE_LABELS, CHECKLIST_STATUS, CHECKLIST_TYPE_LABELS } from '../../config/domain'
import { useUpdateChecklistItem } from '../../hooks/useProcesses'
import { checklistItemSchema, type ChecklistItemInput } from '../../schemas/process'
import type { ChecklistItem } from '../../types/process'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'

type ChecklistItemModalProps = {
  organizationId: number
  processId: string
  item: ChecklistItem
  onClose: () => void
}

// Edição de um item do checklist. Em telas pequenas o modal ocupa a tela toda.
export function ChecklistItemModal({ organizationId, processId, item, onClose }: ChecklistItemModalProps) {
  const update = useUpdateChecklistItem(organizationId, processId)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ChecklistItemInput>({
    resolver: zodResolver(checklistItemSchema),
    defaultValues: {
      status: item.status,
      source: item.source ?? '',
      reference: item.reference ?? '',
      occurred_on: item.occurred_on ?? '',
      notes: item.notes ?? '',
    },
  })

  const onSubmit = handleSubmit((values) =>
    update.mutate({ itemId: item.id, input: values }, { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) }),
  )
  const alertMessage = formAlertMessage(update.error)

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          {CHECKLIST_TYPE_LABELS[item.type]}
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}
          <SelectField label="Situação" error={errors.status?.message} {...register('status')}>
            {Object.entries(CHECKLIST_STATUS).map(([value, { label, releases }]) => (
              <option key={value} value={value}>
                {label}
                {releases ? ' (libera a prática)' : ''}
              </option>
            ))}
          </SelectField>
          <SelectField label="Origem da informação" error={errors.source?.message} {...register('source')}>
            <option value="">Não informada</option>
            {Object.entries(CHECKLIST_SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <FormField label="Referência (opcional)" hint="Ex.: número da LADV ou do protocolo." error={errors.reference?.message} {...register('reference')} />
          <FormField label="Data (opcional)" type="date" error={errors.occurred_on?.message} {...register('occurred_on')} />
          <TextAreaField label="Observações" error={errors.notes?.message} {...register('notes')} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={update.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={update.isPending}>Salvar</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
