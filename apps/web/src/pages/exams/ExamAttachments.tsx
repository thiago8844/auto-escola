import { useState } from 'react'
import { Button, Form } from 'react-bootstrap'
import { DataTable } from '../../components/DataTable'
import { QueryState } from '../../components/QueryState'
import { DocumentStatusBadge } from '../../components/StatusBadges'
import { DOCUMENT_TYPE_LABELS } from '../../config/domain'
import { useDocumentFile } from '../../hooks/useDocuments'
import { useUploadExamDocument } from '../../hooks/useExams'
import { useExamDocuments } from '../../hooks/useStudentHistory'
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_MB } from '../../schemas/document'
import type { DocumentType } from '../../types/document'
import { formatDate } from '../../utils/formatDate'

const TYPES: DocumentType[] = ['exam_scheduling', 'exam_result', 'payment_guide', 'payment_proof', 'other']

// Anexos privados da tentativa (agendamento, resultado, guias). Anexar não conclui nenhuma etapa.
export function ExamAttachments({ organizationId, examId, processId }: { organizationId: number; examId: number; processId: number }) {
  const docs = useExamDocuments(organizationId, examId, true)
  const upload = useUploadExamDocument(organizationId)
  const file = useDocumentFile(organizationId)
  const [type, setType] = useState<DocumentType>('exam_scheduling')
  const [chosen, setChosen] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = () => {
    setError(null)
    if (!chosen) return setError('Escolha um arquivo.')
    if (chosen.size > DOCUMENT_MAX_MB * 1024 * 1024) return setError(`O arquivo deve ter no máximo ${DOCUMENT_MAX_MB} MB.`)
    upload.mutate({ file: chosen, type, examId, processId }, { onSuccess: () => setChosen(null), onError: (e) => setError(e.message) })
  }

  return (
    <section aria-labelledby="exam-docs-title" className="mb-4">
      <h2 id="exam-docs-title" className="h4 mb-3">
        Anexos privados
      </h2>
      <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
        <Form.Group controlId="exam-doc-type">
          <Form.Label className="small mb-1">Tipo</Form.Label>
          <Form.Select size="sm" value={type} onChange={(event) => setType(event.target.value as DocumentType)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {DOCUMENT_TYPE_LABELS[t]}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
        <Form.Group controlId="exam-doc-file" className="flex-grow-1">
          <Form.Label className="small mb-1">Arquivo (PDF, JPG, PNG ou WebP, até {DOCUMENT_MAX_MB} MB)</Form.Label>
          <Form.Control size="sm" type="file" accept={DOCUMENT_ACCEPT} isInvalid={!!error} onChange={(event) => setChosen((event.target as HTMLInputElement).files?.[0] ?? null)} />
          <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
        </Form.Group>
        <Button size="sm" onClick={send} disabled={upload.isPending}>
          <i className="bi bi-upload me-1" aria-hidden="true" />
          Anexar
        </Button>
      </div>

      <QueryState query={docs} isEmpty={(d) => d.data.length === 0} empty="Nenhum anexo nesta tentativa.">
        {(data) => (
          <DataTable
            rows={data.data}
            getKey={(doc) => doc.id}
            columns={[
              { header: 'Documento', primary: true, cell: (doc) => `${DOCUMENT_TYPE_LABELS[doc.type]} (v${doc.version})` },
              { header: 'Arquivo', cell: (doc) => <span className="text-break">{doc.original_name}</span> },
              { header: 'Situação', cell: (doc) => <DocumentStatusBadge status={doc.status} /> },
              { header: 'Anexado em', cell: (doc) => formatDate(doc.created_at) },
              {
                header: 'Ações',
                actions: true,
                cell: (doc, { mobile }) => (
                  <Button
                    variant="outline-primary"
                    size={mobile ? undefined : 'sm'}
                    className={mobile ? 'flex-fill' : undefined}
                    disabled={file.isPending}
                    onClick={() => file.mutate({ document: doc, mode: 'view', tab: window.open('', '_blank') })}
                  >
                    <i className="bi bi-eye me-1" aria-hidden="true" />
                    Visualizar
                  </Button>
                ),
              },
            ]}
          />
        )}
      </QueryState>
    </section>
  )
}
