import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Alert, Button, Modal } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { FormField } from '../../components/FormField'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { CHECKLIST_SOURCE_LABELS, CHECKLIST_STATUS, CHECKLIST_TYPE_LABELS, DOCUMENT_TYPE_LABELS } from '../../config/domain'
import { useStudentDocuments } from '../../hooks/useStudentHistory'
import { useUpdateChecklistItem } from '../../hooks/useProcesses'
import { checklistItemSchema, type ChecklistItemInput } from '../../schemas/process'
import type { ChecklistItem } from '../../types/process'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'
import { UploadDocumentModal } from '../students/UploadDocumentModal'

type ChecklistItemModalProps = {
  organizationId: number
  processId: string
  studentId?: number
  item: ChecklistItem
  onClose: () => void
}

// Edição de um item do checklist. Anexar a evidência e conferir são ações separadas: anexar não libera nada.
export function ChecklistItemModal({ organizationId, processId, studentId, item, onClose }: ChecklistItemModalProps) {
  const update = useUpdateChecklistItem(organizationId, processId)
  const documents = useStudentDocuments(organizationId, String(studentId ?? ''), studentId !== undefined)
  const [attaching, setAttaching] = useState(false)
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<ChecklistItemInput>({
    resolver: zodResolver(checklistItemSchema),
    defaultValues: {
      status: item.status,
      source: item.source ?? '',
      reference: item.reference ?? '',
      occurred_on: item.occurred_on ?? '',
      document_id: item.document_id ? String(item.document_id) : '',
      notes: item.notes ?? '',
    },
  })

  const onSubmit = handleSubmit((values) =>
    update.mutate({ itemId: item.id, input: values }, { onSuccess: onClose, onError: (error) => applyFieldErrors(error, setError) }),
  )
  const alertMessage = formAlertMessage(update.error)
  const current = (documents.data?.data ?? []).filter((doc) => doc.status !== 'replaced' && doc.status !== 'rejected')

  return (
    <>
      <Modal show={!attaching} onHide={onClose} centered fullscreen="sm-down">
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

            {studentId !== undefined && (
              <>
                <SelectField label="Evidência (documento privado)" error={errors.document_id?.message} {...register('document_id')}>
                  <option value="">Sem documento vinculado</option>
                  {current.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {DOCUMENT_TYPE_LABELS[doc.type]} · v{doc.version} · {doc.original_name}
                    </option>
                  ))}
                </SelectField>
                <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                  <Button variant="outline-primary" size="sm" onClick={() => setAttaching(true)}>
                    <i className="bi bi-upload me-1" aria-hidden="true" />
                    Anexar novo documento
                  </Button>
                  <span className="small text-secondary">Anexar não confere o item: depois escolha a situação “Conferido”.</span>
                </div>
              </>
            )}

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

      {attaching && studentId !== undefined && (
        <UploadDocumentModal
          organizationId={organizationId}
          owner={{ student_id: studentId, qualification_process_id: Number(processId) }}
          title={`Evidência: ${CHECKLIST_TYPE_LABELS[item.type]}`}
          onClose={() => setAttaching(false)}
          onUploaded={(doc) => setValue('document_id', String(doc.id))}
        />
      )}
    </>
  )
}
