// Os horários da API vêm em UTC; o espaço tem um fuso (ex.: America/Sao_Paulo).
// Tudo que o usuário digita ou vê passa por estas funções com o fuso do espaço.

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number }

function zonedParts(utcMs: number, timeZone: string): Parts {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const get = (type: string) => Number(formatted.find((part) => part.type === type)?.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

function offsetMs(utcMs: number, timeZone: string): number {
  const p = zonedParts(utcMs, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs
}

const pad = (value: number) => String(value).padStart(2, '0')

// '2026-10-19' + '09:00' no fuso do espaço -> ISO em UTC
export function zonedTimeToIso(date: string, time: string, timeZone: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const wallClock = Date.UTC(year, month - 1, day, hour, minute)
  let result = wallClock - offsetMs(wallClock, timeZone)
  // Segunda passada: perto da troca de horário de verão o deslocamento muda
  result = wallClock - offsetMs(result, timeZone)
  return new Date(result).toISOString()
}

// ISO em UTC -> data e hora no fuso do espaço
export function isoToZonedParts(iso: string, timeZone: string): { date: string; time: string } {
  const p = zonedParts(new Date(iso).getTime(), timeZone)
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` }
}

export function todayInTimeZone(timeZone: string): string {
  return isoToZonedParts(new Date().toISOString(), timeZone).date
}

// Datas 'YYYY-MM-DD' são tratadas como dias de calendário, sem fuso
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return `${result.getUTCFullYear()}-${pad(result.getUTCMonth() + 1)}-${pad(result.getUTCDate())}`
}

// Semana de segunda a domingo
export function startOfWeek(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() // 0 = domingo
  return addDays(date, -((weekday + 6) % 7))
}

export function formatDayLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
}

export function formatTime(iso: string, timeZone: string): string {
  return isoToZonedParts(iso, timeZone).time
}
