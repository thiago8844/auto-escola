import { Button, Card, ListGroup } from 'react-bootstrap'
import { MUTABLE_NOTICES } from '../config/notices'
import { usePreferencesStore } from '../stores/preferencesStore'
import { formatDate } from '../utils/formatDate'

// Avisos que o usuário silenciou com "Não mostrar novamente", com opção de reativar
export function MutedNoticesSettings() {
  const muted = usePreferencesStore((state) => state.mutedNotices)
  const unmute = usePreferencesStore((state) => state.unmute)
  const unmuteAll = usePreferencesStore((state) => state.unmuteAll)
  const entries = Object.entries(muted)

  return (
    <Card>
      <Card.Body>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <Card.Title as="h2" className="h5 mb-0">
            Avisos ocultos
          </Card.Title>
          {entries.length > 1 && (
            <Button variant="outline-secondary" size="sm" onClick={unmuteAll}>
              Reativar todos
            </Button>
          )}
        </div>
        <p className="small text-secondary">Avisos que você escolheu não ver mais. Reative aqui se quiser voltar a recebê-los.</p>

        {entries.length === 0 ? (
          <p className="text-secondary mb-0">Você não ocultou nenhum aviso.</p>
        ) : (
          <ListGroup variant="flush">
            {entries.map(([key, mutedAt]) => (
              <ListGroup.Item key={key} className="d-flex flex-wrap align-items-center justify-content-between gap-2 px-0">
                <div className="min-w-0">
                  <div className="fw-semibold text-break">{MUTABLE_NOTICES[key]?.label ?? key}</div>
                  <div className="small text-secondary">
                    {MUTABLE_NOTICES[key]?.description ? `${MUTABLE_NOTICES[key].description} · ` : ''}Ocultado em {formatDate(mutedAt)}
                  </div>
                </div>
                <Button variant="outline-primary" size="sm" onClick={() => unmute(key)}>
                  Reativar
                </Button>
              </ListGroup.Item>
            ))}
          </ListGroup>
        )}
      </Card.Body>
    </Card>
  )
}
