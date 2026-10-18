import { useQuery } from '@tanstack/react-query'
import { Spinner } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import { listStudentCommunications } from '../api/communications'
import { organizationPaths } from '../config/paths'
import { QueryErrorAlert } from './QueryErrorAlert'

export function StudentCommunicationHistory({ organizationId, studentId }: { organizationId: number; studentId: number }) {
  const query = useQuery({
    queryKey: ['organizations', String(organizationId), 'student', String(studentId), 'communications'],
    queryFn: () => listStudentCommunications(organizationId, studentId),
  })
  const links = organizationPaths(organizationId)

  if (query.error) return <QueryErrorAlert error={query.error} onRetry={() => void query.refetch()} />
  if (!query.data) return <Spinner animation="border" size="sm" aria-label="Carregando comunicações" />
  if (query.data.length === 0) return <p className="text-secondary">Nenhuma comunicação registrada.</p>

  return (
    <ul className="list-group mb-4">
      {query.data.map((item) => (
        <li key={item.id} className="list-group-item">
          <Link to={links.lesson(item.lesson_id)}>Aula #{item.lesson_id}</Link> · {item.channel === 'email' ? 'E-mail' : 'WhatsApp'} · {item.status === 'sent' ? 'Aceito para envio' : item.status === 'marked_sent' ? 'Marcado como enviado' : item.status === 'opened' ? 'Aberto, sem envio confirmado' : item.status === 'failed' ? 'Falha' : 'Em envio'}
          <div className="small text-secondary">{new Date(item.created_at).toLocaleString('pt-BR')} · {item.recipient} · {item.actor?.name ?? 'Equipe'}</div>
        </li>
      ))}
    </ul>
  )
}
