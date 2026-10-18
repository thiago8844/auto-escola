import { useSearchParams } from 'react-router-dom'
import { addDays, startOfWeek, todayInTimeZone } from '../utils/timezone'

export type AgendaView = 'dia' | 'semana'

// Visão (dia/semana), data e filtros ficam na URL: dá para compartilhar o link e voltar com o botão do navegador
export function useAgendaState(timeZone: string) {
  const [searchParams, setSearchParams] = useSearchParams()
  const view: AgendaView = searchParams.get('visao') === 'semana' ? 'semana' : 'dia'
  const today = todayInTimeZone(timeZone)
  const rawDate = searchParams.get('data') ?? ''
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : today

  const first = view === 'semana' ? startOfWeek(date) : date
  const last = view === 'semana' ? addDays(first, 6) : date
  const step = view === 'semana' ? 7 : 1
  const days = Array.from({ length: view === 'semana' ? 7 : 1 }, (_, i) => addDays(first, i))

  function update(changes: Record<string, string | null>) {
    setSearchParams(
      (params) => {
        const next = new URLSearchParams(params)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  }

  return { searchParams, view, date, today, first, last, step, days, update }
}
