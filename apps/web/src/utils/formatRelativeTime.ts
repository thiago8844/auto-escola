const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

// "agora", "há 5 minutos", "ontem"; passados 7 dias, a data
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return 'agora'
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 86400) return rtf.format(Math.round(seconds / 86400), 'day')
  return new Intl.DateTimeFormat('pt-BR').format(new Date(iso))
}
