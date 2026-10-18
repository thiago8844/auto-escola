import { zodResolver } from '@hookform/resolvers/zod'
import { Alert, Button, Form, Modal } from 'react-bootstrap'
import { useForm } from 'react-hook-form'
import { FormField } from '../../components/FormField'
import { SelectField } from '../../components/SelectField'
import { SubmitButton } from '../../components/SubmitButton'
import { TextAreaField } from '../../components/TextAreaField'
import { DOCUMENT_TYPE_LABELS } from '../../config/domain'
import type { DocumentOwner } from '../../api/documents'
import { useUploadDocument } from '../../hooks/useDocuments'
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_MB, documentUploadSchema, type DocumentUploadInput } from '../../schemas/document'
import type { DocumentType, StudentDocument } from '../../types/document'
import { applyFieldErrors, formAlertMessage } from '../../utils/applyFieldErrors'

type UploadDocumentModalProps = {
  organizationId: number
  // Titular do documento: aluno, veículo ou processo
  owner: DocumentOwner
  // Nova versão de um documento: o tipo fica travado no do original
  replacing?: { type: DocumentType; label: string }
  // Sugestão de tipo quando o documento nasce de um fluxo (ex.: CRLV do veículo)
  defaultType?: DocumentType
  title?: string
  onClose: () => void
  onUploaded?: (document: StudentDocument) => void
}

// Agrupa os tipos no seletor. Cada tipo aparece em um único grupo.
const DOCUMENT_GROUPS: { label: string; types: DocumentType[] }[] = [
  { label: 'Pessoais', types: ['identity', 'current_license', 'proof_of_residence'] },
  { label: 'Do processo e do CFC', types: ['learning_license', 'theory_completion', 'assessment_result', 'process_protocol', 'official_request', 'official_lesson_record'] },
  { label: 'Exame', types: ['exam_scheduling', 'exam_result'] },
  { label: 'Financeiro', types: ['payment_guide', 'payment_proof', 'receipt', 'contract'] },
  { label: 'Veículo', types: ['vehicle_registration'] },
  { label: 'Outros', types: ['other'] },
]

// Documentos exigidos para o exame prático (conferidos pelo checklist do processo).
const EXAM_REQUIRED_TYPES: DocumentType[] = ['identity', 'current_license', 'learning_license', 'theory_completion']

// Upload de PDF, JPG, PNG ou WebP até 10 MB. Tipo e tamanho são conferidos aqui e de novo na API.
export function UploadDocumentModal({ organizationId, owner, replacing, defaultType, title, onClose, onUploaded }: UploadDocumentModalProps) {
  const upload = useUploadDocument(organizationId, owner)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DocumentUploadInput>({
    resolver: zodResolver(documentUploadSchema),
    defaultValues: { type: replacing?.type ?? defaultType, issuer: '', issued_at: '', expires_at: '', notes: '' },
  })

  const onSubmit = handleSubmit((values) =>
    upload.mutate(values, {
      onSuccess: (document) => {
        onUploaded?.(document)
        onClose()
      }, onError: (error) => applyFieldErrors(error, setError) }),
  )
  const alertMessage = formAlertMessage(upload.error)

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          {title ?? (replacing ? `Substituir: ${replacing.label}` : 'Anexar documento')}
        </Modal.Title>
      </Modal.Header>
      <form onSubmit={onSubmit} noValidate>
        <Modal.Body>
          {alertMessage && <Alert variant="danger" role="alert">{alertMessage}</Alert>}

          <Form.Group className="mb-3" controlId="file">
            <Form.Label>Arquivo</Form.Label>
            <Form.Control type="file" accept={DOCUMENT_ACCEPT} isInvalid={!!errors.file} {...register('file')} />
            <Form.Control.Feedback type="invalid">{errors.file?.message as string | undefined}</Form.Control.Feedback>
            <Form.Text muted>PDF, JPG, PNG ou WebP, até {DOCUMENT_MAX_MB} MB.</Form.Text>
          </Form.Group>

          {replacing && <p className="small text-secondary">O arquivo atual continua no histórico como versão anterior. Depois de anexar, confira a nova versão.</p>}
          {replacing ? (
            <input type="hidden" {...register('type')} />
          ) : (
            <SelectField label="Tipo do documento" error={errors.type?.message} {...register('type')}>
              <option value="" disabled>
                Escolha o tipo
              </option>
              {DOCUMENT_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.types.map((value) => (
                    <option key={value} value={value}>
                      {DOCUMENT_TYPE_LABELS[value]}
                      {EXAM_REQUIRED_TYPES.includes(value) ? ' (obrigatório)' : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </SelectField>
          )}
          <FormField label="Emissor (opcional)" error={errors.issuer?.message} {...register('issuer')} />
          <FormField label="Emitido em (opcional)" type="date" error={errors.issued_at?.message} {...register('issued_at')} />
          <FormField label="Válido até (opcional)" type="date" hint="Sem data, a validade é indeterminada." error={errors.expires_at?.message} {...register('expires_at')} />
          <TextAreaField label="Observações (opcional)" error={errors.notes?.message} {...register('notes')} />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onClose} disabled={upload.isPending}>
            Cancelar
          </Button>
          <SubmitButton loading={upload.isPending}>Enviar</SubmitButton>
        </Modal.Footer>
      </form>
    </Modal>
  )
}
