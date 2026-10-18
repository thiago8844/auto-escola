import { useQuery } from '@tanstack/react-query'
import { Button } from 'react-bootstrap'
import { http } from '../api/client'
import { formatTime } from '../utils/timezone'
import { QueryErrorAlert } from './QueryErrorAlert'

type Slot = { starts_at: string; ends_at: string }
type Props = { organizationId: number; timezone: string; enrollmentId: string; instructorId: string; vehicleId: string; date: string; duration: string; category: string; fromTime: string; onChoose: (slot: Slot) => void }
export function SlotSuggestions(props: Props) {
  const params = { enrollment_id: props.enrollmentId, instructor_id: props.instructorId, vehicle_id: props.vehicleId || undefined, category: props.category || undefined, date: props.date, duration: props.duration, from_time: props.fromTime || '08:00' }
  const query = useQuery({
    queryKey: ['organizations', String(props.organizationId), 'lesson-slots', params],
    enabled: false,
    retry: false,
    queryFn: async () => (await http.get<{ data: Slot[]; meta: { message: string } }>(`/organizations/${props.organizationId}/lesson-slots`, { params, skipGlobalError: true })).data,
  })
  const valid = props.enrollmentId && props.instructorId && props.date && Number(props.duration) > 0 && Number(props.duration) <= 240
  return <section className="border rounded p-3 mb-3" aria-label="Sugestões de horários">
    <Button size="sm" variant="outline-primary" disabled={!valid || query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? 'Conferindo horários…' : 'Encontrar horário livre neste dia'}</Button>
    <p className="small text-secondary mt-2 mb-0">{valid ? `A partir de ${props.fromTime || '08:00'}, com o instrutor, veículo e duração escolhidos. A consulta não reserva a aula.` : 'Escolha aluno, instrutor, dia e duração para consultar.'}</p>
    {query.error && <div className="mt-2"><QueryErrorAlert error={query.error} onRetry={() => void query.refetch()} /></div>}
    {query.data && !query.isFetching && !query.error && <div className="mt-2" aria-live="polite">
      {query.data.data.length ? <><div className="d-flex flex-wrap gap-2">{query.data.data.map((slot) => <Button key={slot.starts_at} size="sm" variant="outline-secondary" onClick={() => props.onChoose(slot)}>{formatTime(slot.starts_at, props.timezone)}–{formatTime(slot.ends_at, props.timezone)}</Button>)}</div><p className="small text-secondary mt-2 mb-0">{query.data.meta.message}</p></> : <p className="small mb-0">Nenhum horário encontrado neste dia a partir da hora escolhida. Altere o dia, o instrutor ou o veículo e consulte novamente.</p>}
    </div>}
  </section>
}
