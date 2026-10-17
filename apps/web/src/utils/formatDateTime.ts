// Data e hora no fuso do espaço (os horários da API vêm em UTC)
export function formatDateTime(value: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone }).format(new Date(value))
}
