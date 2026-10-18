import { Button, Modal } from 'react-bootstrap'
import { DocumentStatusBadge } from '../../components/StatusBadges'
import { QueryState } from '../../components/QueryState'
import { DOCUMENT_TYPE_LABELS } from '../../config/domain'
import { useDocumentFile, useDocumentVersions } from '../../hooks/useDocuments'
import type { StudentDocument } from '../../types/document'
import { formatDate } from '../../utils/formatDate'

type DocumentVersionsModalProps = { organizationId: number; document: StudentDocument; onClose: () => void }

// Histórico de versões de um documento: a vigente e as substituídas, cada uma com seu arquivo
export function DocumentVersionsModal({ organizationId, document, onClose }: DocumentVersionsModalProps) {
  const versions = useDocumentVersions(organizationId, document.id, true)
  const file = useDocumentFile(organizationId)

  return (
    <Modal show onHide={onClose} centered fullscreen="sm-down">
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5">
          Versões: {DOCUMENT_TYPE_LABELS[document.type]}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <QueryState query={versions} isEmpty={(data) => data.length === 0} empty="Nenhuma versão encontrada.">
          {(data) => (
            <ul className="list-unstyled mb-0 d-grid gap-3">
              {data.map((version) => (
                <li key={version.id} className="border-bottom pb-3">
                  <div className="d-flex flex-wrap justify-content-between gap-2">
                    <strong>Versão {version.version}</strong>
                    <DocumentStatusBadge status={version.status} />
                  </div>
                  <div className="small text-secondary text-break">
                    {version.original_name} · anexado em {formatDate(version.created_at)}
                    {version.expires_at && <> · vale até {formatDate(version.expires_at)}</>}
                  </div>
                  <div className="d-flex gap-2 mt-2">
                    <Button size="sm" variant="outline-primary" disabled={file.isPending} onClick={() => file.mutate({ document: version, mode: 'view', tab: window.open('', '_blank') })}>
                      Visualizar
                    </Button>
                    <Button size="sm" variant="outline-secondary" disabled={file.isPending} onClick={() => file.mutate({ document: version, mode: 'download', tab: null })}>
                      Baixar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </QueryState>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={onClose}>Fechar</Button>
      </Modal.Footer>
    </Modal>
  )
}
