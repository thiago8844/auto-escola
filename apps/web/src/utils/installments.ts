import { addDays } from './timezone'

export type Periodicity = 'monthly' | 'biweekly' | 'weekly'

// Soma meses a uma data 'AAAA-MM-DD' sem estourar o fim do mês (31/01 + 1 mês = 28/02 ou 29/02)
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(day, lastDay))}`
}

// Mesma regra da API: a soma fecha exatamente o total e a sobra vai de 1 em 1 centavo a partir da primeira parcela
export function planInstallments(totalCents: number, count: number, firstDue: string, periodicity: Periodicity): Array<{ due_date: string; amount_cents: number }> {
  if (totalCents < 1 || count < 1 || count > totalCents || !firstDue) return []
  const base = Math.floor(totalCents / count)
  const extra = totalCents % count
  const step = periodicity === 'weekly' ? 7 : 14

  return Array.from({ length: count }, (_, index) => ({
    due_date: periodicity === 'monthly' ? addMonths(firstDue, index) : addDays(firstDue, step * index),
    amount_cents: base + (index < extra ? 1 : 0),
  }))
}
