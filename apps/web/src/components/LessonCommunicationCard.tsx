import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Card, Spinner } from 'react-bootstrap'
import {
  getLessonCommunicationPreview,
  listLessonCommunications,
  markLessonWhatsAppSent,
  openLessonWhatsApp,
  sendLessonEmail,
} from '../api/communications'
import { QueryErrorAlert } from './QueryErrorAlert'
import { notify } from '../stores/toastStore'
import type { Lesson } from '../types/lesson'
import type { LessonCommunication } from '../types/communication'

const statusLabel: Record<LessonCommunication['status'], string> = {
  sending: 'Em envio',
  sent: 'Aceito para envio por e-mail',
  failed: 'Falha no envio',
  opened: 'WhatsApp aberto; envio não confirmado',
  marked_sent: 'Marcado como enviado pela equipe',
}

export function LessonCommunicationCard({ organizationId, lesson }: { organizationId: number; lesson: Lesson }) {
  const queryClient = useQueryClient()
  const key = ['organizations', String(organizationId), 'lesson', String(lesson.id), 'communications']
  const isScheduled = lesson.status === 'scheduled'
  const preview = useQuery({
    queryKey: [...key, 'preview'],
    queryFn: () => getLessonCommunicationPreview(organizationId, lesson.id),
    enabled: isScheduled,
  })
  const history = useQuery({
    queryKey: key,
    queryFn: () => listLessonCommunications(organizationId, lesson.id),
  })
  const refreshHistory = () => queryClient.invalidateQueries({ queryKey: key })
  const sendEmail = useMutation({
    mutationFn: () => sendLessonEmail(organizationId, lesson.id),
    onSuccess: () => {
      notify.success('Confirmação enviada por e-mail.')
      void refreshHistory()
    },
    onError: () => void refreshHistory(),
  })
  const openWhatsApp = useMutation({
    mutationFn: () => openLessonWhatsApp(organizationId, lesson.id),
    onSuccess: () => void refreshHistory(),
  })
  const markSent = useMutation({
    mutationFn: (communicationId: number) => markLessonWhatsAppSent(organizationId, lesson.id, communicationId),
    onSuccess: () => {
      notify.success('WhatsApp marcado como enviado.')
      void refreshHistory()
    },
  })

  const emailAlreadySent = history.data?.some((item) => item.channel === 'email' && item.status === 'sent' && item.recipient === preview.data?.email && item.body === preview.data?.body)

  function handleWhatsApp() {
    const tab = window.open('about:blank', '_blank')
    openWhatsApp.mutate(undefined, {
      onSuccess: ({ url }) => {
        if (tab) tab.location.href = url
        else window.location.href = url
      },
      onError: () => tab?.close(),
    })
  }

  return (
    <Card className="mb-4">
      <Card.Body>
        <Card.Title as="h2" className="h5">Comunicação com o aluno</Card.Title>
        {!isScheduled && <p className="text-secondary mb-0">Confirmações só podem ser enviadas para aulas futuras agendadas.</p>}
        {isScheduled && preview.isPending && <Spinner animation="border" size="sm" aria-label="Carregando mensagem" />}
        {preview.error && <QueryErrorAlert error={preview.error} onRetry={() => void preview.refetch()} />}
        {preview.data && (
          <>
            <p className="small text-secondary mb-2">Confira a mensagem antes de enviar:</p>
            <div className="border rounded p-3 mb-3 bg-body-tertiary">
              <div className="fw-semibold mb-2">{preview.data.subject}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{preview.data.body}</div>
            </div>
            <div className="d-flex flex-wrap gap-2 mb-2">
              <Button disabled={!preview.data.can_email || emailAlreadySent || sendEmail.isPending} onClick={() => sendEmail.mutate()}>
                {sendEmail.isPending ? 'Enviando…' : emailAlreadySent ? 'E-mail já enviado' : 'Enviar por e-mail'}
              </Button>
              <Button variant="outline-success" disabled={!preview.data.can_whatsapp || openWhatsApp.isPending} onClick={handleWhatsApp}>
                Abrir WhatsApp
              </Button>
            </div>
            {!preview.data.can_email && <p className="small text-secondary mb-1">Cadastre o e-mail do aluno para usar este canal.</p>}
            {!preview.data.can_whatsapp && <p className="small text-secondary mb-1">Cadastre um celular com DDD para usar o WhatsApp.</p>}
            <p className="small text-secondary mb-0">Abrir o WhatsApp não envia a mensagem. Após enviar, marque o registro abaixo.</p>
          </>
        )}
        {sendEmail.error && <Alert variant="danger" className="mt-3">{sendEmail.error.message}</Alert>}
        {openWhatsApp.error && <Alert variant="danger" className="mt-3">{openWhatsApp.error.message}</Alert>}
        {markSent.error && <Alert variant="danger" className="mt-3">{markSent.error.message}</Alert>}

        <h3 className="h6 mt-4">Histórico desta aula</h3>
        {history.error && <QueryErrorAlert error={history.error} onRetry={() => void history.refetch()} />}
        {!history.data && !history.error && <Spinner animation="border" size="sm" aria-label="Carregando histórico" />}
        {history.data?.length === 0 && <p className="text-secondary mb-0">Nenhuma comunicação registrada.</p>}
        {history.data && history.data.length > 0 && (
          <ul className="list-group">
            {history.data.map((item) => (
              <li key={item.id} className="list-group-item d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div>
                  <strong>{item.channel === 'email' ? 'E-mail' : 'WhatsApp'}</strong> · {statusLabel[item.status]}
                  <div className="small text-secondary">{item.recipient} · {new Date(item.created_at).toLocaleString('pt-BR')} · {item.actor?.name ?? 'Equipe'}</div>
                </div>
                {item.channel === 'whatsapp_manual' && item.status === 'opened' && (
                  <Button size="sm" variant="outline-primary" disabled={markSent.isPending} onClick={() => markSent.mutate(item.id)}>
                    Marcar como enviado
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card.Body>
    </Card>
  )
}
