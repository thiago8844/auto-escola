import type { WeeklyHours } from '../types/availability'

const DAY_LABELS: Array<[string, string]> = [
  ['1', 'Seg'],
  ['2', 'Ter'],
  ['3', 'Qua'],
  ['4', 'Qui'],
  ['5', 'Sex'],
  ['6', 'Sáb'],
  ['7', 'Dom'],
]

// Resumo em uma linha para mostrar a regra vigente sem abrir o editor
export function summarizeHours(hours: WeeklyHours | null): string {
  if (!hours || Object.keys(hours).length === 0) return 'Agenda livre: só os bloqueios restringem os horários.'
  return DAY_LABELS.filter(([day]) => hours[day]?.length)
    .map(([day, label]) => `${label} ${hours[day].map((i) => `${i.start}–${i.end}`).join(' e ')}`)
    .join(' · ')
}
